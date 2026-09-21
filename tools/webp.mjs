#!/usr/bin/env node
/**
 * Generates the WebP variants of the docs/ captures for a local preview.
 *
 *   npm run webp
 *
 * docs/index.html prefers WebP through <picture>, and a browser does not fall
 * back to the <img> PNG once a <source> fails — so a fresh checkout needs the
 * WebP files to exist or every capture renders blank. They are gitignored and
 * generated at deploy time by .github/workflows/pages.yml; this is the local
 * equivalent, with the same quality and the same two widths, so the two do not
 * drift.
 *
 * Each PNG yields two files: the full-width `X.webp` and a `X-640.webp` for the
 * `srcset` on narrow screens, where a phone would otherwise download a 1280px
 * capture to show it ~390px wide.
 *
 * cwebp is preferred because it is what the workflow runs; ImageMagick and
 * Pillow are accepted fallbacks. Only Node's standard library is used, and a
 * file whose WebP is already newer is skipped, so re-running is cheap.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs');
const QUALITY = '82';
// null = full width; 640 matches the `srcset` in docs/index.html.
const WIDTHS = [null, 640];

function which(cmd) {
  const res = spawnSync('sh', ['-c', `command -v ${cmd}`], {
    encoding: 'utf8',
  });
  return res.status === 0 ? res.stdout.trim() : null;
}

const cwebp = which('cwebp');
const magick = which('magick') || which('convert');
const python = which('python3');

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: 'inherit' }).status === 0;
}

function convert(png, webp, width) {
  if (cwebp) {
    const args = ['-quiet', '-q', QUALITY];
    if (width) args.push('-resize', String(width), '0');
    args.push(png, '-o', webp);
    return run(cwebp, args);
  }
  if (magick) {
    const args = [png];
    if (width) args.push('-resize', `${width}x`);
    args.push('-quality', QUALITY, '-define', 'webp:method=6', webp);
    return run(magick, args);
  }
  if (python) {
    const script = width
      ? `import sys; from PIL import Image; im = Image.open(sys.argv[1]).convert("RGB"); w = ${width}; im = im.resize((w, max(1, round(im.height * w / im.width)))); im.save(sys.argv[2], quality=82, method=6)`
      : `import sys; from PIL import Image; Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2], quality=82, method=6)`;
    return run(python, ['-c', script, png, webp]);
  }
  console.error(
    'webp: need cwebp, ImageMagick or Pillow (python3-PIL) on PATH',
  );
  process.exit(1);
}

function outName(name, width) {
  return width
    ? name.replace(/\.png$/, `-${width}.webp`)
    : name.replace(/\.png$/, '.webp');
}

let written = 0;
let fresh = 0;
let failed = 0;

for (const name of readdirSync(docs)) {
  if (!name.endsWith('.png')) continue;
  const png = join(docs, name);
  for (const width of WIDTHS) {
    const out = outName(name, width);
    const webp = join(docs, out);
    if (existsSync(webp) && statSync(webp).mtimeMs >= statSync(png).mtimeMs) {
      fresh += 1;
      continue;
    }
    if (convert(png, webp, width)) {
      written += 1;
    } else {
      failed += 1;
      console.error(`webp: failed ${out}`);
    }
  }
}

console.log(
  `webp: ${written} written, ${fresh} up to date${failed ? `, ${failed} failed` : ''}`,
);
if (failed) process.exitCode = 1;
