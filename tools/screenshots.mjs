#!/usr/bin/env node
/**
 * Captures the extension's screenshots — the GitHub Pages before/after pairs and
 * the store-listing shots — from the built extension and the live sites.
 *
 *   node tools/screenshots.mjs project   # docs/ orientation pairs (repo pages)
 *   node tools/screenshots.mjs profile   # docs/ orientation pairs (profiles)
 *   node tools/screenshots.mjs store     # store/screenshots, 1280x720
 *
 * A *job* is one URL: the base frame with every skin off, then one frame per skin
 * with that skin on. Capturing the base once per URL — rather than once per skin
 * — keeps the pair the same moment, so [`docs/index.html`](../docs/index.html)
 * can lay them over each other as a before/after swipe. A *store shot* is a
 * single frame with the named skin on.
 *
 * Any failure exits non-zero: the output is committed, and a silent failure
 * would leave a stale image that looks fine until someone compares it with the
 * live site.
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const OFF = { github: 'off', gitlab: 'off' };
const PAGE = { width: 1280, height: 900 };
const STORE = { width: 1280, height: 720 };

// How long to let the skin settle (fonts, token repaint) before the shot, and
// how long to wait for the page's own marker. One place, so the captures cannot
// drift into different timing.
const SETTLE_MS = 2500;

// Project-page jobs. Both pages are public and carry the real chrome (header,
// token colours, logo) the skins repaint. `ready` waits for the page's own
// marker, so the shot is not on a skeleton.
const PROJECT_JOBS = [
  {
    name: 'GitLab project',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    ready: '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    base: 'gitlab-default.png',
    skins: [
      {
        setting: { gitlab: 'github' },
        cls: 'gs-theme-github',
        over: 'gitlab-github.png',
      },
      {
        setting: { gitlab: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'gitlab-bitbucket.png',
      },
    ],
  },
  {
    name: 'GitHub project',
    url: 'https://github.com/microsoft/vscode',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    base: 'github-default.png',
    skins: [
      {
        setting: { github: 'gitlab' },
        cls: 'gs-theme-gitlab',
        over: 'github-gitlab.png',
      },
      {
        setting: { github: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'github-bitbucket.png',
      },
    ],
  },
  // Codeberg is GitHub-flavoured, so any of the three skins can be captured from
  // the same base. The Gitea project nav is an `overflow-menu`; the GitLab and
  // Bitbucket skins rebuild it as `[data-gs-gitea-nav]`, so `ready` accepts
  // either.
  {
    name: 'Codeberg (Gitea) project',
    url: 'https://codeberg.org/forgejo/forgejo',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    skins: [
      { setting: { github: 'gitlab' }, cls: 'gs-theme-gitlab', over: 'codeberg-gitlab.png' },
      { setting: { github: 'github' }, cls: 'gs-theme-github', over: 'codeberg-github.png' },
      { setting: { github: 'bitbucket' }, cls: 'gs-theme-bitbucket', over: 'codeberg-bitbucket.png' },
    ],
  },
];

// Profile-page jobs. The profiles are public and rich enough to show both the
// navigation and the metadata the skin repaints.
const PROFILE_JOBS = [
  {
    name: 'GitLab profile',
    // A profile with bio, location and contact links set, so the card has more
    // than the name to show — sytses (the example in the docs) has neither.
    url: 'https://gitlab.com/dzaporozhets',
    ready: '.super-sidebar:not(.super-sidebar-loading) .user-profile-header, .user-profile-header',
    base: 'gitlab-profile-default.png',
    skins: [
      {
        setting: { gitlab: 'github' },
        cls: 'gs-theme-github',
        over: 'gitlab-profile-github.png',
      },
      {
        setting: { gitlab: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'gitlab-profile-bitbucket.png',
      },
    ],
  },
  {
    name: 'GitHub profile',
    url: 'https://github.com/torvalds',
    ready: 'nav[aria-label="User profile"]',
    base: 'github-profile-default.png',
    skins: [
      {
        setting: { github: 'gitlab' },
        cls: 'gs-theme-gitlab',
        over: 'github-profile-gitlab.png',
      },
      {
        setting: { github: 'bitbucket' },
        cls: 'gs-theme-bitbucket',
        over: 'github-profile-bitbucket.png',
      },
    ],
  },
];

// Store-listing shots: one frame each, with the named skin on. The base shot is
// per source, so the setting is per shot too — one skin is active at a time.
const STORE_SHOTS = [
  {
    name: 'GitHub project as GitLab',
    url: 'https://github.com/microsoft/vscode',
    setting: { github: 'gitlab' },
    cls: 'gs-theme-gitlab',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    file: '01-as-gitlab.png',
  },
  {
    name: 'GitLab project as GitHub',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    setting: { gitlab: 'github' },
    cls: 'gs-theme-github',
    ready: '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    file: '02-as-github.png',
  },
];

const MODES = {
  project: { out: 'docs', viewport: PAGE, jobs: PROJECT_JOBS },
  profile: { out: 'docs', viewport: PAGE, jobs: PROFILE_JOBS },
  store: { out: 'store/screenshots', viewport: STORE, headless: false, shots: STORE_SHOTS, popup: true },
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
  if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
  await popup.waitForTimeout(300);

  // Keep the PNG bytes in hand rather than writing then re-reading them.
  const shot = await popup.locator('body').screenshot();
  await writeFile(join(out, '03-popup.png'), shot);
  const box = await popup.locator('body').boundingBox();
  console.log(`    -> 03-popup.png (${Math.round(box.width)}x${Math.round(box.height)})`);

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
  console.error(`usage: node tools/screenshots.mjs <${Object.keys(MODES).join('|')}>`);
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
