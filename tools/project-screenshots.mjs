#!/usr/bin/env node
/**
 * Captures the project-page orientation pairs used by the GitHub Pages preview.
 *
 * It launches a Chromium with `dist/chromium` loaded unpacked, visits a public
 * GitHub repo and a public GitLab project, and writes four 1280×900 PNGs to
 * `docs/`:
 *
 *   gitlab-default.png   GitLab as it ships   (vertical sidebar)
 *   gitlab-github.png    the same, skinned   (horizontal top bar)
 *   github-default.png   GitHub as it ships   (horizontal tab bar)
 *   github-gitlab.png    the same, skinned   (vertical sidebar column)
 *
 * The base and the skinned shot are the same URL at the same viewport and
 * scroll, so [`index.html`](../docs/index.html) can lay them over each other as
 * a before/after swipe. The profile-page pairs are the same idea
 * (`profile-screenshots.mjs`).
 *
 * Only `playwright-core` is needed — the browser is the system Chromium, so
 * nothing is downloaded. Point at a different browser with `GS_CHROME=...`.
 *
 *   node tools/project-screenshots.mjs
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
// site skinned as the other product. Both pages are public and carry the real
// chrome (header, token colours, logo) the skins repaint.
const PAIRS = [
  {
    name: 'GitLab project',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    setting: { github: 'off', gitlab: 'github' },
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
    setting: { github: 'gitlab', gitlab: 'off' },
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
    setting: { github: 'gitlab', gitlab: 'off' },
    cls: 'gs-theme-gitlab',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    over: 'codeberg-gitlab.png',
  },
  {
    name: 'Codeberg (Gitea) project, GitHub UI',
    url: 'https://codeberg.org/forgejo/forgejo',
    setting: { github: 'github', gitlab: 'off' },
    cls: 'gs-theme-github',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    over: 'codeberg-github.png',
  },
  {
    name: 'Codeberg (Gitea) project, Bitbucket UI',
    url: 'https://codeberg.org/forgejo/forgejo',
    setting: { github: 'bitbucket', gitlab: 'off' },
    cls: 'gs-theme-bitbucket',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    base: 'codeberg-default.png',
    over: 'codeberg-bitbucket.png',
  },
];

const profile = await mkdtemp(join(tmpdir(), 'gs-project-shots-'));

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
      await page.waitForSelector(pair.ready, { timeout: 45000 }).catch(() => {});
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
      await page.waitForSelector(pair.ready, { timeout: 45000 }).catch(() => {});
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

  console.log(`\nwrote project screenshots to ${OUT}`);
} finally {
  await context.close();
}
