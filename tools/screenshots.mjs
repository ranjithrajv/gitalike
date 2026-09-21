#!/usr/bin/env node
/**
 * Captures the extension's screenshots — the GitHub Pages before/after pairs and
 * the store-listing shots — from the built extension and the live sites.
 *
 *   node tools/screenshots.mjs project   # docs/ orientation pairs (repo pages)
 *   node tools/screenshots.mjs profile   # docs/ orientation pairs (profiles)
 *   node tools/screenshots.mjs store     # store/screenshots, 1280x720
 *
 * What it captures lives in `tools/captures.mjs`, which the tests and the page
 * are checked against; this file is only the capture loop.
 *
 * A *job* is one URL: the base frame with every skin off, then one frame per skin
 * with that skin on. Capturing the base once per URL — rather than once per skin
 * — keeps the pair the same moment, so [`docs/index.html`](../docs/index.html)
 * can lay them over each other as a before/after swipe.
 *
 * Any failure exits non-zero: the output is committed (the PNGs; the WebP
 * variants are generated at deploy), and a silent failure would leave a stale
 * image that looks fine until someone compares it with the live site.
 *
 * Only `playwright-core` is needed — the browser is the system Chromium, so
 * nothing is downloaded. Point at a different browser with `GS_CHROME=...`, and
 * at a different output directory with `GS_OUT=...`.
 *
 * The store requirements this satisfies:
 *   - Chrome Web Store: at least one 1280x720 screenshot.
 *   - addons.mozilla.org: screenshots are optional but recommended.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, retry } from './harness.mjs';
import { PROFILE_JOBS, PROJECT_JOBS, STORE_SHOTS } from './captures.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const OFF = { github: 'off', gitlab: 'off' };
const PAGE = { width: 1280, height: 900 };
const STORE = { width: 1280, height: 720 };

// How long to let the skin settle (fonts, token repaint) before the shot. One
// place, so the captures cannot drift into different timing.
const SETTLE_MS = 2500;

const MODES = {
  project: { out: 'docs', viewport: PAGE, jobs: PROJECT_JOBS },
  profile: { out: 'docs', viewport: PAGE, jobs: PROFILE_JOBS },
  store: {
    out: 'store/screenshots',
    viewport: STORE,
    headless: false,
    shots: STORE_SHOTS,
    popup: true,
  },
};

// Any capture that failed. The output is committed, so a silent failure would
// leave a stale image; a non-zero exit makes it visible.
let failed = 0;

/** Wait out the page's own marker, then let the skin settle, then top the page. */
async function settle(page, ready) {
  await page.waitForSelector(ready, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function captureJobs(context, setSettings, out, jobs) {
  for (const job of jobs) {
    const page = await context.newPage();
    try {
      console.log(`  ${job.name}`);

      // The base: every skin off. Give the storage write a moment to reach the
      // content script, then wait out any cached theme the origin had applied.
      await setSettings(OFF);
      await page.waitForTimeout(600);
      await retry(() =>
        page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
      );
      await page
        .waitForFunction(
          () =>
            ![...document.documentElement.classList].some((c) =>
              c.startsWith('gs-theme-'),
            ),
          null,
          { timeout: 15000 },
        )
        .catch(() => {});
      await settle(page, job.ready);
      await page.screenshot({ path: join(out, job.base) });
      console.log(`    -> ${job.base}`);

      // Each skin, from the first paint: reload so the skin is applied the way a
      // visitor would get it.
      for (const skin of job.skins) {
        await setSettings(skin.setting);
        await retry(() =>
          page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }),
        );
        await page.waitForFunction(
          (c) => document.documentElement.classList.contains(c),
          skin.cls,
          { timeout: 45000 },
        );
        await settle(page, job.ready);
        await page.screenshot({ path: join(out, skin.over) });
        console.log(`    -> ${skin.over}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`    FAILED ${job.name}: ${error.message}`);
    } finally {
      await page.close();
    }
  }
}

async function captureShots(context, setSettings, out, shots) {
  for (const shot of shots) {
    const page = await context.newPage();
    try {
      console.log(`  ${shot.name}`);
      await setSettings(shot.setting);
      await retry(() =>
        page.goto(shot.url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
      );
      await page.waitForFunction(
        (c) => document.documentElement.classList.contains(c),
        shot.cls,
        { timeout: 45000 },
      );
      await settle(page, shot.ready);
      await page.screenshot({ path: join(out, shot.file) });
      console.log(`    -> ${shot.file}`);
    } catch (error) {
      failed += 1;
      console.error(`    FAILED ${shot.file}: ${error.message}`);
    } finally {
      await page.close();
    }
  }
}

// The popup itself, at its natural size, for addons.mozilla.org. The body is a
// fixed 322px wide; screenshot the element so the viewport cannot stretch it.
// Collapse the "Add a site" form, which auto-opens when it cannot tell which
// host it is on, so the switches are what the shot shows.
async function capturePopup(context, popup, out, viewport) {
  await popup.setViewportSize({ width: 420, height: 1000 });
  const toggle = popup.locator('#add-toggle');
  if ((await toggle.getAttribute('aria-expanded')) === 'true')
    await toggle.click();
  await popup.waitForTimeout(300);

  // Keep the PNG bytes in hand rather than writing then re-reading them.
  const shot = await popup.locator('body').screenshot();
  await writeFile(join(out, '03-popup.png'), shot);
  const box = await popup.locator('body').boundingBox();
  console.log(
    `    -> 03-popup.png (${Math.round(box.width)}x${Math.round(box.height)})`,
  );

  // A Chrome Web Store shot must be exactly 1280x720, so frame the popup.
  const frame = await context.newPage();
  await frame.setViewportSize(viewport);
  await frame.setContent(
    `<html><body style="margin:0;height:100vh;display:grid;place-items:center;
      background:linear-gradient(135deg,#fca326 0%,#e24329 45%,#7759c2 100%)">
      <img alt="gitalike popup" style="max-height:78vh;border-radius:12px;
        box-shadow:0 24px 60px rgba(0,0,0,.35)" src="data:image/png;base64,${shot.toString('base64')}">
    </body></html>`,
  );
  await frame.screenshot({ path: join(out, '04-popup-1280x720.png') });
  console.log('    -> 04-popup-1280x720.png');
}

const mode = process.argv[2];
const config = MODES[mode];
if (!config) {
  console.error(
    `usage: node tools/screenshots.mjs <${Object.keys(MODES).join('|')}>`,
  );
  process.exit(1);
}

const out = process.env.GS_OUT ?? join(root, config.out);
await mkdir(out, { recursive: true });

const { context, popup, setSettings, close } = await launch({
  viewport: config.viewport,
  headless: config.headless ?? true,
  profilePrefix: `gs-${mode}-shots-`,
});

try {
  if (config.jobs) await captureJobs(context, setSettings, out, config.jobs);
  if (config.shots) await captureShots(context, setSettings, out, config.shots);
  if (config.popup) await capturePopup(context, popup, out, config.viewport);
  console.log(`\nwrote ${mode} screenshots to ${out}`);
} finally {
  await close();
}

if (failed) {
  console.error(`${failed} capture(s) failed`);
  process.exitCode = 1;
}
