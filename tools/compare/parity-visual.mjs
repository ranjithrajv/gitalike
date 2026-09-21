#!/usr/bin/env node
/**
 * Visual parity scoring: how far each skin moves a page from the source's own
 * original, measured on the committed captures.
 *
 * For a source and a skin, the skinned capture is compared with the *same page's*
 * unskinned capture (`*-default.png`). Because both are the same site, the same
 * repository and the same moment, only the skin differs, so the number is a real
 * image measurement rather than a rubric. Both images are reduced to a luma
 * grid and compared with SSIM.
 *
 * The native cell — a source wearing its own UI, so no skin is painted — is the
 * page against itself: identical, 10.0. An off-diagonal cell is the source's
 * original against its skinned self, so 10 means the skin changed nothing and a
 * lower number means it changed more. It is a *displacement* score, not a
 * fidelity-to-target score.
 *
 *   node tools/compare/parity-visual.mjs             markdown tables
 *   node tools/compare/parity-visual.mjs --json
 *
 * The captures come from `npm run screenshots:projects` / `:profiles`; this tool
 * only reads them, so the score always describes the PNGs in the repo. Override
 * the directory with `GS_CAPTURES=...`.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROJECT_JOBS, PROFILE_JOBS, themeOf } from './captures.mjs';
// The parity rubrics publish the source and skin tables; reuse them so this
// report's columns and row labels cannot drift from the rubric table's.
import { SKINS, SOURCES } from './parity-score.mjs';
import { decodePng, lumaGrid, ssim } from './png.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const DIR = process.env.GS_CAPTURES ?? join(root, 'docs');

const sourceByKey = new Map(SOURCES.map((source) => [source.key, source]));

/** The rubric row labels, so a capture job maps onto one. */
const SOURCE_BY_PREFIX = {
  github: sourceByKey.get('github'),
  gitlab: sourceByKey.get('gitlab'),
  codeberg: sourceByKey.get('gitea'),
};

/* ------------------------------------------------------------------ table -- */

function readGrid(file, cache, crop = null, factor = 8) {
  const key = crop
    ? `${file}|${crop.x},${crop.y},${crop.w},${crop.h}|${factor}`
    : `${file}|${factor}`;
  if (!cache.has(key)) {
    const png = decodePng(readFileSync(join(DIR, file)));
    cache.set(key, lumaGrid(png, factor, crop));
  }
  return cache.get(key);
}

function scoreJobs(jobs) {
  const cache = new Map();
  const rows = [];
  for (const job of jobs) {
    const prefix = job.base.split('-')[0];
    const source = SOURCE_BY_PREFIX[prefix];
    if (!source) continue;
    const base = readGrid(job.base, cache);
    const cells = {};
    // The native cell: the source on its own UI is the base against itself.
    if (SKINS.some((skin) => skin.key === source.key)) {
      cells[source.key] = 10;
    }
    for (const skin of job.skins) {
      const key = themeOf(skin);
      cells[key] =
        Math.round(ssim(base, readGrid(skin.over, cache)) * 100) / 10;
    }
    rows.push({ label: source.label, cells });
  }
  return rows;
}

function render(rows) {
  const header = `| Source ↓ / Skin → | ${SKINS.map((s) => s.label).join(' | ')} |`;
  const rule = `| --- | ${SKINS.map(() => ':--:').join(' | ')} |`;
  console.log(header);
  console.log(rule);
  for (const row of rows) {
    const cells = SKINS.map((skin) =>
      row.cells[skin.key] === undefined ? '—' : row.cells[skin.key].toFixed(1),
    );
    console.log(`| **${row.label}** | ${cells.join(' | ')} |`);
  }
}

// The original of each product a skin imitates. Bitbucket has no captured
// original, so its column cannot be measured this way.
// Bitbucket has no public user profile, so its profile reference is a public
// workspace repositories page — the closest thing to an account page it serves.
const REFERENCES = {
  project: {
    github: 'github-default.png',
    gitlab: 'gitlab-default.png',
    bitbucket: 'bitbucket-default.png',
  },
  profile: {
    github: 'github-profile-default.png',
    gitlab: 'gitlab-profile-default.png',
    bitbucket: 'bitbucket-profile-default.png',
  },
};

// The chrome band of each imitated product: the top bar and navigation, not the
// page body. GitHub's is the top strip (dark bar + repo header + tab row);
// GitLab's and Bitbucket's are the left sidebar. Cropping here is what makes the
// comparison about the skin rather than the source's content.
const CHROME = {
  github: { x: 0, y: 0, w: 1280, h: 190 },
  gitlab: { x: 0, y: 0, w: 280, h: 900 },
  bitbucket: { x: 0, y: 0, w: 280, h: 900 },
};

// How faithfully each result reproduces the imitated product: the skinned
// capture (or the base, for the native cell) against that product's original.
// With `chrome`, both sides are cropped to the target's chrome band.
function fidelityJobs(jobs, references, chrome = false) {
  const cache = new Map();
  const rows = [];
  for (const job of jobs) {
    const source = SOURCE_BY_PREFIX[job.base.split('-')[0]];
    if (!source) continue;
    const overs = new Map(job.skins.map((skin) => [themeOf(skin), skin.over]));
    const cells = {};
    for (const skin of SKINS) {
      const reference = references[skin.key];
      const file = skin.key === source.key ? job.base : overs.get(skin.key);
      if (!reference || !file) continue;
      const crop = chrome ? CHROME[skin.key] : null;
      // A coarse grid blurs the glyphs away, so the chrome compare is about the
      // palette and block layout — the design language — not the source's text.
      const factor = chrome ? 24 : 8;
      cells[skin.key] =
        Math.round(
          ssim(
            readGrid(reference, cache, crop, factor),
            readGrid(file, cache, crop, factor),
          ) * 100,
        ) / 10;
    }
    rows.push({ label: source.label, cells });
  }
  return rows;
}

/* ------------------------------------------------- design tokens (colour) -- */

function medianChannel(values) {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

// The median colour of a region: the chrome's dominant surface, robust to text.
function regionMedian(png, crop) {
  const { width, height, channels, data } = png;
  const x0 = crop ? crop.x : 0;
  const y0 = crop ? crop.y : 0;
  const w = Math.min(crop ? crop.w : width, width - x0);
  const h = Math.min(crop ? crop.h : height, height - y0);
  const rs = [];
  const gs = [];
  const bs = [];
  for (let y = y0; y < y0 + h; y += 3) {
    for (let x = x0; x < x0 + w; x += 3) {
      const i = (y * width + x) * channels;
      rs.push(data[i]);
      gs.push(data[i + (channels >= 3 ? 1 : 0)]);
      bs.push(data[i + (channels >= 3 ? 2 : 0)]);
    }
  }
  return [medianChannel(rs), medianChannel(gs), medianChannel(bs)];
}

// The most-used saturated colour: a product's brand accent shows up on its
// primary button, links and active tab, and survives a coarse histogram.
function accentColor(png) {
  const { width, height, channels, data } = png;
  const hist = new Map();
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + (channels >= 3 ? 1 : 0)];
      const b = data[i + (channels >= 3 ? 2 : 0)];
      if (Math.max(r, g, b) - Math.min(r, g, b) < 50) continue;
      const key = `${r >> 4},${g >> 4},${b >> 4}`;
      hist.set(key, (hist.get(key) || 0) + 1);
    }
  }
  let best = null;
  let count = 0;
  for (const [key, n] of hist) {
    if (n > count) {
      count = n;
      best = key;
    }
  }
  return best
    ? best.split(',').map((v) => Number(v) * 16 + 8)
    : [128, 128, 128];
}

const colorDist = (a, b) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
const MAX_DIST = Math.sqrt(3 * 255 ** 2);

// Palette similarity: the target's chrome surface and brand accent against the
// result's. Content-independent, so it measures the design language directly.
function paletteJobs(jobs, references) {
  const pngs = new Map();
  const png = (file) => {
    if (!pngs.has(file)) {
      pngs.set(file, decodePng(readFileSync(join(DIR, file))));
    }
    return pngs.get(file);
  };
  const rows = [];
  for (const job of jobs) {
    const source = SOURCE_BY_PREFIX[job.base.split('-')[0]];
    if (!source) continue;
    const overs = new Map(job.skins.map((skin) => [themeOf(skin), skin.over]));
    const cells = {};
    for (const skin of SKINS) {
      const reference = references[skin.key];
      const file = skin.key === source.key ? job.base : overs.get(skin.key);
      if (!reference || !file) continue;
      const crop = CHROME[skin.key];
      const chrome = colorDist(
        regionMedian(png(reference), crop),
        regionMedian(png(file), crop),
      );
      const accent = colorDist(
        accentColor(png(reference)),
        accentColor(png(file)),
      );
      const similarity = 1 - (0.5 * chrome + 0.5 * accent) / MAX_DIST;
      cells[skin.key] = Math.max(0, Math.round(similarity * 100) / 10);
    }
    rows.push({ label: source.label, cells });
  }
  return rows;
}

const chromeOnly = process.argv.includes('--chrome');
const paletteOnly = process.argv.includes('--palette');
const project = scoreJobs(PROJECT_JOBS);
const profile = scoreJobs(PROFILE_JOBS);
const projectFidelity = fidelityJobs(PROJECT_JOBS, REFERENCES.project);
const profileFidelity = fidelityJobs(PROFILE_JOBS, REFERENCES.profile);
const projectChrome = fidelityJobs(PROJECT_JOBS, REFERENCES.project, true);
const profileChrome = fidelityJobs(PROFILE_JOBS, REFERENCES.profile, true);
const projectPalette = paletteJobs(PROJECT_JOBS, REFERENCES.project);
const profilePalette = paletteJobs(PROFILE_JOBS, REFERENCES.profile);

if (process.argv.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        displacement: { project, profile },
        fidelity: { project: projectFidelity, profile: profileFidelity },
        chrome: { project: projectChrome, profile: profileChrome },
        palette: { project: projectPalette, profile: profilePalette },
      },
      null,
      2,
    ),
  );
} else if (paletteOnly) {
  console.log('\nProject pages — design tokens vs the imitated product\n');
  render(projectPalette);
  console.log('\nProfile pages — design tokens vs the imitated product\n');
  render(profilePalette);
} else if (chromeOnly) {
  console.log(
    '\nProject pages — fidelity to the imitated product (chrome band)\n',
  );
  render(projectChrome);
  console.log(
    '\nProfile pages — fidelity to the imitated product (chrome band)\n',
  );
  render(profileChrome);
} else {
  console.log('\nProject pages — displacement from the source\n');
  render(project);
  console.log(
    '\nProject pages — fidelity to the imitated product (whole page)\n',
  );
  render(projectFidelity);
  console.log(
    '\nProject pages — fidelity to the imitated product (chrome band)\n',
  );
  render(projectChrome);
  console.log('\nProfile pages — displacement from the source\n');
  render(profile);
  console.log(
    '\nProfile pages — fidelity to the imitated product (whole page)\n',
  );
  render(profileFidelity);
  console.log(
    '\nProfile pages — fidelity to the imitated product (chrome band)\n',
  );
  render(profileChrome);
}
