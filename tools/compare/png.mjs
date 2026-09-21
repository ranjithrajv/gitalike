/**
 * Minimal PNG decode + luma comparison, shared by the visual tools so the image
 * code lives once. Chromium screenshots are 8-bit, non-interlaced PNGs; this
 * handles that shape with no image dependency beyond Node's zlib.
 */
import { inflateSync } from 'node:zlib';

/** Decode an 8-bit non-interlaced PNG into `{ width, height, channels, data }`. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let at = 8;
  let header = null;
  const idat = [];
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString('ascii', at + 4, at + 8);
    const data = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  if (!header || header.depth !== 8 || header.interlace !== 0) {
    throw new Error('unsupported PNG (need 8-bit, non-interlaced)');
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header.color];
  if (!channels) throw new Error(`unsupported PNG colour type ${header.color}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = header.width * channels;
  const out = Buffer.alloc(stride * header.height);
  let prev = Buffer.alloc(stride);
  let at2 = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[at2];
    at2 += 1;
    const row = raw.subarray(at2, at2 + stride);
    at2 += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = row[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      cur[x] = v;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width: header.width, height: header.height, channels, data: out };
}

/**
 * Reduce to a coarse luma grid; a box average over each cell keeps the measure
 * stable against a one-pixel repaint or an anti-aliasing change. An optional
 * `crop` restricts the grid to a rectangle.
 */
export function lumaGrid(png, factor = 8, crop = null) {
  const { width, height, channels, data } = png;
  const x0 = crop ? crop.x : 0;
  const y0 = crop ? crop.y : 0;
  const w = crop ? crop.w : width;
  const h = crop ? crop.h : height;
  const gw = Math.floor(w / factor);
  const gh = Math.floor(h / factor);
  const grid = new Float64Array(gw * gh);
  for (let gy = 0; gy < gh; gy += 1) {
    for (let gx = 0; gx < gw; gx += 1) {
      let sum = 0;
      for (let y = y0 + gy * factor; y < y0 + (gy + 1) * factor; y += 1) {
        for (let x = x0 + gx * factor; x < x0 + (gx + 1) * factor; x += 1) {
          const i = (y * width + x) * channels;
          const r = data[i];
          const g = data[i + (channels >= 3 ? 1 : 0)];
          const b = data[i + (channels >= 3 ? 2 : 0)];
          sum += channels >= 3 ? 0.299 * r + 0.587 * g + 0.114 * b : r;
        }
      }
      grid[gy * gw + gx] = sum / (factor * factor);
    }
  }
  return grid;
}

/** Global SSIM over two equal-length luma grids. */
export function ssim(a, b) {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i += 1) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let va = 0;
  let vb = 0;
  let cov = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    va += da * da;
    vb += db * db;
    cov += da * db;
  }
  va /= n;
  vb /= n;
  cov /= n;
  const c1 = 6.5025; // (0.01 * 255)^2
  const c2 = 58.5225; // (0.03 * 255)^2
  const value =
    ((2 * ma * mb + c1) * (2 * cov + c2)) /
    ((ma * ma + mb * mb + c1) * (va + vb + c2));
  return Math.max(0, Math.min(1, value));
}
