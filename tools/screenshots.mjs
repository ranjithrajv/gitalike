#!/usr/bin/env node
/**
 * Captures the extension's screenshots — the GitHub Pages before/after pairs and
 * the store-listing shots — from the built extension and the live sites.
 *
 *   node tools/screenshots.mjs project   # docs/ orientation pairs (repo pages)
 *   node tools/screenshots.mjs profile   # docs/ orientation pairs (profiles)
 *   node tools/screenshots.mjs store     # store/screenshots, 1280x720
 *
 * A *pair* is the same URL captured twice — once with every skin off, once with
 * the named skin on — at the same viewport and scroll, so
 * [`docs/index.html`](../docs/index.html) can lay them over each other as a
 * before/after swipe. A *store shot* is a single frame with the named skin on.
 * One capture loop serves both, so the settle timing is one decision rather than
 * three that drift apart.
 *
 * Only `playwright-core` is needed — the browser is the system Chromium, so
 * nothing is downloaded. Point at a different browser with `GS_CHROME=...`, and
 * at a different output directory with `GS_OUT=...`.
 *
 * The store requirements this satisfies:
 *   - Chrome Web Store: at least one 1280x720 screenshot.
 *   - addons.mozilla.org: screenshots are optional but recommended.
 */

import { mkdir, readFile } from 'node:fs/promises';
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

// Project-page orientation pairs. Both pages are public and carry the real
// chrome (header, token colours, logo) the skins repaint.
const PROJECT_PAIRS = [
  {
    name: 'GitLab project',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    setting: { gitlab: 'github' },
    cls: 'gs-theme-github',
    // The super-sidebar ships with a loading state; wait for the settled one,
    // or the project header, so the shot is not on a skeleton.
    ready: '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    base: 'gitlab-default.png',
    over: 'gitlab-github.png',
  },
  {
    name: 'GitHub project',
    url: 'https://github.com/microsoft/vscode',
    setting: { github: 'gitlab' },
    cls: 'gs-theme-gitlab',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    base: 'github-default.png',
    over: 'github-gitlab.png',
  },
  // Codeberg is GitHub-flavoured, so any of the three skins can be captured from
  // the same base shot. The Gitea project nav is an `overflow-menu`; the GitLab
  // and Bitbucket skins rebuild it as `[data-gs-gitea-nav]`, so `ready` accepts
  // either.
  {
    name: 'Codeberg (Gitea) project, GitLab UI',
    url: 'https://codeberg.org/forgejo/forgejo',
    setting: { github: 'gitlab' },
    cls: 'gs-theme-gitlab',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    over: 'codeberg-gitlab.png',
  },
  {
    name: 'Codeberg (Gitea) project, GitHub UI',
    url: 'https://codeberg.org/forgejo/forgejo',
    setting: { github: 'github' },
    cls: 'gs-theme-github',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    over: 'codeberg-github.png',
  },
  {
    name: 'Codeberg (Gitea) project, Bitbucket UI',
    url: 'https://codeberg.org/forgejo/forgejo',
    setting: { github: 'bitbucket' },
    cls: 'gs-theme-bitbucket',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    over: 'codeberg-bitbucket.png',
  },
];

// Profile-page orientation pairs. The profiles are public and rich enough to
// show both the navigation and the metadata the skin repaints.
const PROFILE_PAIRS = [
  {
    name: 'GitLab profile',
    // A profile with bio, location and contact links set, so the card has more
    // than the name to show — sytses (the example in the docs) has neither.
    url: 'https://gitlab.com/dzaporozhets',
    setting: { gitlab: 'github' },
    cls: 'gs-theme-github',
    // The profile page's own markers, so the shot is taken after the sidebar
    // and the profile header have rendered rather than on a skeleton.
    ready: '.super-sidebar:not(.super-sidebar-loading) .user-profile-header, .user-profile-header',
    base: 'gitlab-profile-default.png',
    over: 'gitlab-profile-github.png',
  },
  {
    name: 'GitHub profile',
    url: 'https://github.com/torvalds',
    setting: { github: 'gitlab' },
    cls: 'gs-theme-gitlab',
    ready: 'nav[aria-label="User profile"]',
    base: 'github-profile-default.png',
    over: 'github-profile-gitlab.png',
  },
];

// Store-listing shots: one frame each, with the named skin on. The base shot is
// per-source, so the setting is per shot too — one skin is active at a time.
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
  project: { out: 'docs', viewport: PAGE, pairs: PROJECT_PAIRS },
  profile: { out: 'docs', viewport: PAGE, pairs: PROFILE_PAIRS },
  store: { out: 'store/screenshots', viewport: STORE, headless: false, shots: STORE_SHOTS, popup: true },
};

/** Wait out the page's own marker, then let the skin settle, then top the page. */
async function settle(page, ready) {
  await page.waitForSelector(ready, { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function capturePairs(context, setSettings, out, pairs) {
  for (const pair of pairs) {
    const page = await context.newPage();
    try {
      console.log(`  ${pair.name}`);

      // Pass one: the plain site. Give the storage write a moment to reach the
      // content script, then wait out any cached theme the origin had applied.
      await setSettings(OFF);
      await page.waitForTimeout(600);
      await retry(() =>
        page.goto(pair.url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
      );
      await page
        .waitForFunction(
          (c) => !document.documentElement.classList.contains(c),
          pair.cls,
          { timeout: 15000 },
        )
        .catch(() => {});
      await settle(page, pair.ready);
      await page.screenshot({ path: join(out, pair.base) });
      console.log(`    -> ${pair.base}`);

      // Pass two: the same page with the skin on. Reload so the skin is applied
      // from the first paint, exactly as a visitor would get it.
      await setSettings(pair.setting);
      await retry(() =>
        page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      );
      await page.waitForFunction(
        (c) => document.documentElement.classList.contains(c),
        pair.cls,
        { timeout: 45000 },
      );
      await settle(page, pair.ready);
      await page.screenshot({ path: join(out, pair.over) });
      console.log(`    -> ${pair.over}`);
    } catch (error) {
      console.error(`    FAILED ${pair.name}: ${error.message}`);
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
  await popup.locator('body').screenshot({ path: join(out, '03-popup.png') });
  const box = await popup.locator('body').boundingBox();
  console.log(`    -> 03-popup.png (${Math.round(box.width)}x${Math.round(box.height)})`);

  // A Chrome Web Store shot must be exactly 1280x720, so frame the popup.
  const shot = (await readFile(join(out, '03-popup.png'))).toString('base64');
  const frame = await context.newPage();
  await frame.setViewportSize(viewport);
  await frame.setContent(
    `<html><body style="margin:0;height:100vh;display:grid;place-items:center;
      background:linear-gradient(135deg,#fca326 0%,#e24329 45%,#7759c2 100%)">
      <img alt="gitalike popup" style="max-height:78vh;border-radius:12px;
        box-shadow:0 24px 60px rgba(0,0,0,.35)" src="data:image/png;base64,${shot}">
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
  if (config.pairs) await capturePairs(context, setSettings, out, config.pairs);
  if (config.shots) await captureShots(context, setSettings, out, config.shots);
  if (config.popup) await capturePopup(context, popup, out, config.viewport);
  console.log(`\nwrote ${mode} screenshots to ${out}`);
} finally {
  await close();
}
