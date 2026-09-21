/**
 * Unit tests for tools/compare/captures.mjs — the capture tables that three things have
 * to agree on: the table, the PNGs on disk, and the `<picture>` blocks in
 * docs/index.html. It is the same idiom as the `// css` selector test: one place
 * declares the contract, a test proves the others still match it.
 *
 * The WebP variants are generated at deploy time (`.github/workflows/pages.yml`),
 * so only the PNGs are checked on disk; index.html is checked to reference both.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  PROFILE_JOBS,
  PROJECT_JOBS,
  STORE_SHOTS,
} from '../../tools/compare/captures.mjs';

const docsJobs = [...PROJECT_JOBS, ...PROFILE_JOBS];
const captureFiles = (job) => [job.base, ...job.skins.map((skin) => skin.over)];
const page = () =>
  readFileSync(new URL('../../docs/index.html', import.meta.url), 'utf8');
const onDisk = (file) =>
  existsSync(new URL(`../../docs/${file}`, import.meta.url));

// Names index.html uses that are not captures.
const PAGE_ASSETS = new Set(['icon-32.png', 'icon-128.png', 'og.png']);

describe('capture tables', () => {
  test('every docs capture has a PNG on disk', () => {
    for (const job of docsJobs) {
      for (const file of captureFiles(job)) {
        assert.ok(onDisk(file), `${file} exists`);
      }
    }
  });

  test('every store shot has a PNG on disk', () => {
    for (const shot of STORE_SHOTS) {
      assert.ok(
        existsSync(
          new URL(`../../store/screenshots/${shot.file}`, import.meta.url),
        ),
        `${shot.file} exists`,
      );
    }
  });

  test('index.html references every capture and its webp sibling', () => {
    const html = page();
    for (const job of docsJobs) {
      for (const file of captureFiles(job)) {
        assert.ok(html.includes(`"${file}"`), `index.html references ${file}`);
        // The webp is a <source> candidate, so it is followed by a width
        // descriptor ("X.webp 1280w"), not by the closing quote.
        assert.ok(
          html.includes(`${file.replace(/\.png$/, '.webp')} `),
          `index.html references the webp sibling of ${file}`,
        );
      }
    }
  });

  test('index.html references no capture outside the tables', () => {
    // The other direction, so a deleted job does not leave an orphan image on
    // the page and a hand-added image is not served without a capture.
    const known = new Set();
    for (const job of docsJobs)
      for (const file of captureFiles(job)) known.add(file);
    for (const name of page().match(/[a-z0-9-]+\.png/g) || []) {
      if (PAGE_ASSETS.has(name)) continue;
      assert.ok(
        known.has(name),
        `index.html references ${name}, which no capture job produces`,
      );
    }
  });
});
