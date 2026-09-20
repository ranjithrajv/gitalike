#!/usr/bin/env node
/**
 * End-to-end test for Git Same, driven with Playwright.
 *
 * It launches a Chromium with `dist/chromium` loaded unpacked, turns both skins
 * on through the extension's own storage, visits the two live sites and asserts
 * what the skin actually did — orientation, relabelling, reference markers,
 * no-counterpart badges, a keyboard shortcut, and a clean revert.
 *
 *   node tools/e2e.mjs
 *
 * Only `playwright-core` is needed — the browser is the system Chromium, so
 * nothing is downloaded. Point at a different browser with `GS_CHROME=...`.
 *
 * Because it drives live sites, a network hiccup can fail a step; the summary
 * says which. Exit code is non-zero if anything failed.
 */

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = process.env.GS_EXT ?? join(root, 'dist', 'chromium');

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

const results = [];
const check = (name, ok, detail) => results.push({ name, ok: Boolean(ok), detail });

const profile = await mkdtemp(join(tmpdir(), 'gs-e2e-'));
const context = await chromium.launchPersistentContext(profile, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

const setSettings = (page, settings) =>
  page.evaluate((s) => chrome.storage.sync.set({ gitSameSettings: s }), settings);

try {
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 25000 });
  const extId = new URL(worker.url()).host;
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
  check('extension loads', Boolean(worker));

  await setSettings(popup, { github: 'gitlab', gitlab: 'github' });

  /* ------------------------------ GitHub -> GitLab ------------------------------ */
  const gh = await context.newPage();
  await gh.goto('https://github.com/git/git', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await gh.waitForFunction(
    () => document.documentElement.classList.contains('gs-theme-gitlab'),
    null,
    { timeout: 45000 },
  );
  await gh.waitForTimeout(2500);
  const g = await gh.evaluate(async () => {
    const ul = document.querySelector('nav[aria-label="Repository"] ul.UnderlineNav-body');
    const ref = document.createElement('a');
    ref.setAttribute('href', '/git/git/pull/42');
    ref.id = 'gs-ref';
    ref.textContent = '#42';
    document.body.appendChild(ref);
    const disc = document.createElement('a');
    disc.setAttribute('href', '/git/git/discussions');
    disc.textContent = 'Discussions';
    ul?.appendChild(disc);
    await new Promise((r) => setTimeout(r, 2000));
    return {
      direction: ul ? getComputedStyle(ul).flexDirection : null,
      nav: [...document.querySelectorAll('nav[aria-label="Repository"] a')]
        .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      ref: document.getElementById('gs-ref')?.textContent ?? null,
      badge: document.querySelector('.gs-no-equiv')?.textContent ?? null,
    };
  });
  check('G→L repo nav is vertical', g.direction === 'column', g.direction);
  check('G→L nav relabelled', g.nav.includes('Repository') && g.nav.includes('Merge requests 387'), g.nav.slice(0, 4).join(', '));
  check('G→L reference marker #42 → !42', g.ref === '!42', g.ref);
  check('G→L no-counterpart badge', g.badge === '≠ GitLab', g.badge);

  /* ------------------------------ GitLab -> GitHub ------------------------------ */
  const gl = await context.newPage();
  await gl.goto('https://gitlab.com/gitlab-org/gitlab', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await gl.waitForFunction(
    () => document.documentElement.classList.contains('gs-theme-github'),
    null,
    { timeout: 45000 },
  );
  await gl.waitForTimeout(3500);
  const l = await gl.evaluate(() => {
    const sb = document.querySelector('.super-sidebar');
    const main = document.querySelector('main');
    return {
      position: sb ? getComputedStyle(sb).position : null,
      mainWidth: main ? Math.round(main.getBoundingClientRect().width) : null,
      nav: [...document.querySelectorAll('.super-sidebar a')]
        .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim()),
      badges: document.querySelectorAll('.gs-no-equiv').length,
    };
  });
  check('L→G sidebar is horizontal (static)', l.position === 'static', l.position);
  check('L→G content stays full width', l.mainWidth > 1000, `${l.mainWidth}px`);
  check('L→G nav relabelled', l.nav.some((t) => t.startsWith('Pull requests')), l.nav.slice(0, 2).join(', '));
  check('L→G no-counterpart badges', l.badges > 0, `${l.badges} badges`);

  await gl.keyboard.press('g');
  await gl.keyboard.press('p');
  await gl.waitForTimeout(3000);
  check('L→G shortcut g p opens merge requests', /\/merge_requests$/.test(gl.url()), gl.url());

  /* ---------------------------------- revert ----------------------------------- */
  await setSettings(popup, { github: 'off', gitlab: 'off' });
  await gh.waitForTimeout(1500);
  const r = await gh.evaluate(() => ({
    cls: document.documentElement.className,
    direction: getComputedStyle(document.querySelector('nav[aria-label="Repository"] ul.UnderlineNav-body')).flexDirection,
    nav: [...document.querySelectorAll('nav[aria-label="Repository"] a')]
      .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean),
    badges: document.querySelectorAll('.gs-no-equiv').length,
  }));
  check('revert removes the theme class', !/gs-theme/.test(r.cls), r.cls);
  check('revert restores the nav', r.direction === 'row' && r.nav.includes('Code') && r.nav.includes('Pull requests 387'), r.nav.slice(0, 3).join(', '));
  check('revert removes badges', r.badges === 0, `${r.badges} badges`);
} catch (error) {
  check('run completed', false, error.message);
} finally {
  await context.close();
}

let failed = 0;
for (const { name, ok, detail } of results) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
if (failed) process.exitCode = 1;
