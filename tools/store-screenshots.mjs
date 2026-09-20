#!/usr/bin/env node
/**
 * Captures store-listing screenshots of the built extension.
 *
 * It launches a Chromium with `dist/chromium` loaded unpacked, turns both skins
 * on, visits a GitHub repo and a GitLab project, and writes PNGs to
 * `store/screenshots/`.
 *
 * Only `playwright-core` is needed — the browser is the system Chromium, so
 * nothing is downloaded. Point at a different browser with `GS_CHROME=...`.
 *
 *   npm run screenshots
 *
 * The store requirements this satisfies:
 *   - Chrome Web Store: at least one 1280x720 screenshot.
 *   - addons.mozilla.org: screenshots are optional but recommended.
 */

import { chromium } from 'playwright-core';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = process.env.GS_EXT ?? join(root, 'dist', 'chromium');
const OUT = process.env.GS_OUT ?? join(root, 'store', 'screenshots');

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

const VIEWPORT = { width: 1280, height: 720 };

// A repo page and a project page, both public and both carrying the site's
// real chrome (header, token colours, logo) that the skins repaint.
const SITES = [
  { url: 'https://github.com/microsoft/vscode', cls: 'gs-theme-gitlab', file: '01-github-as-gitlab.png' },
  { url: 'https://gitlab.com/gitlab-org/gitlab', cls: 'gs-theme-github', file: '02-gitlab-as-github.png' },
];

await mkdir(OUT, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'gs-shots-'));

const context = await chromium.launchPersistentContext(profile, {
  executablePath: CHROME,
  headless: false,
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
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 20000 });
  const extId = new URL(worker.url()).host;
  console.log(`extension ${extId} from ${EXT}`);

  // Turn both skins on, straight through the extension's own storage.
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`);
  await popupPage.evaluate(() =>
    chrome.storage.sync.set({
      gitSameSettings: { github: 'gitlab', gitlab: 'github' },
    }),
  );

  for (const { url, cls, file } of SITES) {
    const page = await context.newPage();
    try {
      console.log(`  ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(
        (c) => document.documentElement.classList.contains(c),
        cls,
        { timeout: 45000 },
      );
      // Let the skin settle (fonts, token repaint) before the shot.
      await page.waitForTimeout(2500);
      await page.screenshot({ path: join(OUT, file) });
      console.log(`    -> ${file}`);
    } catch (error) {
      console.error(`    FAILED ${file}: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  // The popup itself, at its natural size, for addons.mozilla.org. The body is
  // a fixed 322px wide; screenshot the element so the viewport cannot stretch
  // it. Collapse the "Add a site" form, which auto-opens when it cannot tell
  // which host it is on, so the two switches are what the shot shows.
  await popupPage.setViewportSize({ width: 420, height: 1000 });
  const toggle = popupPage.locator('#add-toggle');
  if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
  await popupPage.waitForTimeout(300);
  await popupPage.locator('body').screenshot({ path: join(OUT, '03-popup.png') });
  const box = await popupPage.locator('body').boundingBox();
  console.log(`    -> 03-popup.png (${Math.round(box.width)}x${Math.round(box.height)})`);

  // A Chrome Web Store shot must be exactly 1280x720, so frame the popup.
  const shot = (await readFile(join(OUT, '03-popup.png'))).toString('base64');
  const frame = await context.newPage();
  await frame.setViewportSize(VIEWPORT);
  await frame.setContent(
    `<html><body style="margin:0;height:100vh;display:grid;place-items:center;
      background:linear-gradient(135deg,#fca326 0%,#e24329 45%,#7759c2 100%)">
      <img alt="gitalike popup" style="max-height:78vh;border-radius:12px;
        box-shadow:0 24px 60px rgba(0,0,0,.35)" src="data:image/png;base64,${shot}">
    </body></html>`,
  );
  await frame.screenshot({ path: join(OUT, '04-popup-1280x720.png') });
  console.log('    -> 04-popup-1280x720.png');

  console.log(`\nwrote screenshots to ${OUT}`);
} finally {
  await context.close();
}
