#!/usr/bin/env node
/**
 * Captures the profile-page orientation pairs used by the GitHub Pages preview.
 *
 * It launches a Chromium with `dist/chromium` loaded unpacked, visits a public
 * GitHub profile and a public GitLab profile, and writes four 1280×900 PNGs to
 * `docs/`:
 *
 *   gitlab-profile-default.png   GitLab as it ships   (vertical sidebar)
 *   gitlab-profile-github.png    the same, skinned   (horizontal top strip)
 *   github-profile-default.png   GitHub as it ships   (horizontal tab row)
 *   github-profile-gitlab.png    the same, skinned   (vertical left rail)
 *
 * The base and the skinned shot are the same URL at the same viewport and
 * scroll, so [`index.html`](../docs/index.html) can lay them over each other as
 * a before/after swipe. The project-page pairs in `docs/` are the same idea.
 *
 * Only `playwright-core` is needed — the browser is the system Chromium, so
 * nothing is downloaded. Point at a different browser with `GS_CHROME=...`.
 *
 *   node tools/profile-screenshots.mjs
 */

import { chromium } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = process.env.GS_EXT ?? join(root, 'dist', 'chromium');
const OUT = process.env.GS_OUT ?? join(root, 'docs');

const CHROME =
  process.env.GS_CHROME ??
  ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable'].find(
    (p) => existsSync(p),
  );

if (!CHROME) {
  console.error('no Chromium found — set GS_CHROME=/path/to/chrome');
  process.exit(1);
}
if (!existsSync(join(EXT, 'manifest.json'))) {
  console.error(`no manifest.json in ${EXT} — run "npm run build:chromium" first`);
  process.exit(1);
}

const VIEWPORT = { width: 1280, height: 900 };

const OFF = { github: 'off', gitlab: 'off' };

// Each pair is captured twice: once with every skin off, once with the named
// site skinned as the other product. The profiles are public and rich enough to
// show both the navigation and the metadata the skin repaints.
const PAIRS = [
  {
    name: 'GitLab profile',
    // A profile with bio, location and contact links set, so the card has more
    // than the name to show — sytses (the example in the docs) has neither.
    url: 'https://gitlab.com/dzaporozhets',
    setting: { github: 'off', gitlab: 'github' },
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
    setting: { github: 'gitlab', gitlab: 'off' },
    cls: 'gs-theme-gitlab',
    ready: 'nav[aria-label="User profile"]',
    base: 'github-profile-default.png',
    over: 'github-profile-gitlab.png',
  },
];

const profile = await mkdtemp(join(tmpdir(), 'gs-profile-shots-'));

// Live sites hiccup; a navigation failure should not lose the whole capture.
async function navigate(page, action) {
  for (let i = 0; i < 4; i += 1) {
    try {
      await action();
      return;
    } catch (error) {
      if (i === 3) throw error;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

const context = await chromium.launchPersistentContext(profile, {
  executablePath: CHROME,
  headless: true,
  viewport: VIEWPORT,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

try {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 25000 });
  const extId = new URL(worker.url()).host;
  console.log(`extension ${extId} from ${EXT}`);

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  // Read the key from the shared table the popup already loaded, so the tool
  // cannot drift if the storage schema is renamed.
  const setSettings = (settings) =>
    popup.evaluate(
      (s) =>
        chrome.storage.sync.set({
          [globalThis.GITALIKE.SETTINGS_KEY]: s,
        }),
      settings,
    );

  for (const pair of PAIRS) {
    const page = await context.newPage();
    try {
      console.log(`  ${pair.name}`);

      // Pass one: the plain site. Give the storage write a moment to reach the
      // content script, then wait out any cached theme the origin had applied.
      await setSettings(OFF);
      await page.waitForTimeout(600);
      await navigate(page, () =>
        page.goto(pair.url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
      );
      await page
        .waitForFunction(
          (c) => !document.documentElement.classList.contains(c),
          pair.cls,
          { timeout: 15000 },
        )
        .catch(() => {});
      await page.waitForSelector(pair.ready, { timeout: 45000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(OUT, pair.base) });
      console.log(`    -> ${pair.base}`);

      // Pass two: the same page with the skin on. Reload so the skin is applied
      // from the first paint, exactly as a visitor would get it.
      await setSettings(pair.setting);
      await navigate(page, () =>
        page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      );
      await page.waitForFunction(
        (c) => document.documentElement.classList.contains(c),
        pair.cls,
        { timeout: 45000 },
      );
      await page.waitForSelector(pair.ready, { timeout: 45000 });
      await page.waitForTimeout(2500);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(OUT, pair.over) });
      console.log(`    -> ${pair.over}`);
    } catch (error) {
      console.error(`    FAILED ${pair.name}: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  console.log(`\nwrote profile screenshots to ${OUT}`);
} finally {
  await context.close();
}
