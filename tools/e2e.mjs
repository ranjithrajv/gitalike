#!/usr/bin/env node
/**
 * End-to-end test for gitalike, driven with Playwright.
 *
 * It launches a Chromium with `dist/chromium` loaded unpacked, turns both skins
 * on through the extension's own storage, visits the live sites — GitHub,
 * GitLab and Codeberg (Forgejo) — and asserts what the skin actually did:
 * orientation, relabelling, reference markers, no-counterpart badges, a keyboard
 * shortcut, the Gitea tab reorder, and a clean revert.
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
const setHostSettings = (page, hostSettings) =>
  page.evaluate(
    (s) => chrome.storage.sync.set({ gitSameHostSettings: s }),
    hostSettings,
  );

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

  /* GitHub profile, skinned as GitLab: the tab strip becomes a left rail. */
  const ghp = await context.newPage();
  await ghp.goto('https://github.com/torvalds', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ghp.waitForFunction(
    () => document.documentElement.classList.contains('gs-theme-gitlab'),
    null,
    { timeout: 45000 },
  );
  await ghp.waitForTimeout(2500);
  const gp = await ghp.evaluate(() => {
    const nav = document.querySelector(
      'main [data-turbo-frame="user-profile-frame"] nav[aria-label="User profile"]',
    );
    const content = document.querySelector('main > .container-xl > .Layout > .Layout-main');
    return {
      direction: nav ? getComputedStyle(nav).flexDirection : null,
      left: nav ? Math.round(nav.getBoundingClientRect().left) : null,
      contentWidth: content ? Math.round(content.getBoundingClientRect().width) : null,
      nav: nav
        ? [...nav.querySelectorAll('a')]
            .filter((a) => getComputedStyle(a).display !== 'none')
            .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim())
        : [],
      achievements: [...document.querySelectorAll('.h-card .border-top')]
        .filter((b) => b.querySelector('a[href*="tab=achievements"]'))
        .map((b) => getComputedStyle(b).display),
      pinned: document.querySelector('.js-pinned-items-reorder-container')
        ? getComputedStyle(document.querySelector('.js-pinned-items-reorder-container')).display
        : null,
      // GitHub's pinned repositories become GitLab's "Personal projects"
      // section (content/ux.js renames the heading), so the profile has the
      // section GitLab shows.
      pinnedHeading:
        [...document.querySelectorAll('h2')]
          .map((h) => (h.textContent || '').replace(/\s+/g, ' ').trim())
          .find((text) => text.startsWith('Personal projects')) ?? null,
    };
  });
  await ghp.close();
  check('G→L profile nav is vertical', gp.direction === 'column', gp.direction);
  check('G→L profile nav sits in the left rail', gp.left !== null && gp.left < 120, `${gp.left}px`);
  check('G→L profile content stays wide', gp.contentWidth > 800, `${gp.contentWidth}px`);
  check(
    'G→L profile hides GitHub’s Achievements block',
    gp.achievements.length > 0 && gp.achievements.every((d) => d === 'none'),
    gp.achievements.join(', '),
  );
  // GitHub's pinned repositories are kept and relabelled GitLab's "Personal
  // projects" rather than hidden (themes/ux-nav.css): GitLab's profile shows a
  // Personal projects list, and pinned repos are the closest thing to it.
  check(
    'G→L profile keeps Pinned as GitLab’s Personal projects',
    gp.pinned !== null && gp.pinned !== 'none' && Boolean(gp.pinnedHeading),
    `${gp.pinned} / ${gp.pinnedHeading}`,
  );
  check(
    'G→L profile nav is GitLab’s',
    ['Personal projects', 'Contributed projects', 'Starred projects', 'Activity', 'Groups', 'Snippets', 'Followers', 'Following'].every(
      (label) => gp.nav.some((t) => t.startsWith(label)),
    ) && !gp.nav.some((t) => t.startsWith('Repositories')),
    gp.nav.join(', '),
  );

  /* ------------------------------ GitLab -> GitHub ------------------------------ */
  const gl = await context.newPage();
  await gl.goto('https://gitlab.com/gitlab-org/gitlab', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await gl.waitForFunction(
    () => document.documentElement.classList.contains('gs-theme-github'),
    null,
    { timeout: 45000 },
  );
  // The theme class lands at document_start, before GitLab's SPA has rendered
  // its sidebar; wait for the relabel itself rather than guessing at a delay, so
  // a slow load does not fail a step that is really about the rewrite.
  await gl
    .waitForFunction(
      () =>
        [...document.querySelectorAll('.super-sidebar a')].some((a) =>
          /^Pull requests/.test((a.textContent || '').replace(/\s+/g, ' ').trim()),
        ),
      null,
      { timeout: 45000 },
    )
    .catch(() => {});
  await gl.waitForTimeout(500);
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

  /* GitLab profile, skinned as GitHub: counts move under the photo. */
  const glp = await context.newPage();
  await glp.goto('https://gitlab.com/dzaporozhets', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await glp.waitForFunction(
    () => document.documentElement.classList.contains('gs-theme-github'),
    null,
    { timeout: 45000 },
  );
  // Wait for the profile rewrite itself (content/ux.js clones the follower
  // counts into `[data-gs-profile-stats]`), not a guessed delay.
  await glp
    .waitForFunction(() => Boolean(document.querySelector('[data-gs-profile-stats]')), null, {
      timeout: 45000,
    })
    .catch(() => {});
  await glp.waitForTimeout(500);
  const lp = await glp.evaluate(() => {
    const stats = document.querySelector('[data-gs-profile-stats]');
    const followerLink = document.querySelector(
      '.super-sidebar a[data-track-label="followers_menu"]',
    );
    const followerLi = followerLink ? followerLink.closest('li') : null;
    const nav = document.querySelector('.super-sidebar .gl-scroll-scrim ul');
    return {
      stats: stats ? stats.textContent.replace(/\s+/g, ' ').trim() : null,
      inCard: stats ? Boolean(stats.closest('.user-profile-header')) : false,
      navHidden: followerLi ? getComputedStyle(followerLi).display : null,
      localTime: document.querySelector('[data-testid="user-local-time"]')
        ? getComputedStyle(document.querySelector('[data-testid="user-local-time"]')).display
        : null,
      nav: nav
        ? [...nav.querySelectorAll('a')]
            .filter((a) => getComputedStyle(a.closest('li') || a).display !== 'none')
            .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim())
        : [],
    };
  });
  await glp.close();
  check('L→G profile counts sit under the photo', lp.inCard && /followers/i.test(lp.stats || ''), lp.stats);
  check('L→G profile counts leave the navigation', lp.navHidden === 'none', lp.navHidden);
  check('L→G profile hides GitLab’s local time', lp.localTime === 'none', lp.localTime);
  check(
    'L→G profile nav is GitHub’s',
    ['Overview', 'Repositories', 'Projects', 'Packages', 'Stars'].every(
      (label) => lp.nav.some((t) => t.startsWith(label)),
    ) && !lp.nav.some((t) => t.startsWith('Personal projects')),
    lp.nav.join(', '),
  );

  await gl.keyboard.press('g');
  await gl.keyboard.press('p');
  await gl.waitForTimeout(3000);
  check('L→G shortcut g p opens merge requests', /\/merge_requests$/.test(gl.url()), gl.url());

  /* ------------------------------ Codeberg (Gitea) ------------------------------ */
  const cb = await context.newPage();
  await cb.goto('https://codeberg.org/forgejo/forgejo', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await cb.waitForFunction(
    () => document.documentElement.classList.contains('gs-theme-gitlab'),
    null,
    { timeout: 45000 },
  );
  // Wait for the rewrite itself rather than a guessed delay.
  await cb
    .waitForFunction(
      () =>
        [...document.querySelectorAll('overflow-menu .overflow-menu-items a.item')].some((a) =>
          /Merge requests/.test(a.textContent || ''),
        ),
      null,
      { timeout: 45000 },
    )
    .catch(() => {});
  await cb.waitForTimeout(500);
  const readTabs = () =>
    cb.evaluate(() =>
      [...document.querySelectorAll('overflow-menu .overflow-menu-items a.item')].map((a) =>
        (a.textContent || '').replace(/\s+/g, ' ').trim(),
      ),
    );
  const c = { nav: await readTabs() };
  check(
    'Codeberg (Gitea) tabs relabelled',
    c.nav.some((t) => t.startsWith('Repository')) && c.nav.some((t) => t.startsWith('Merge requests')),
    c.nav.join(', '),
  );
  const giteaWorkItems = c.nav.findIndex((t) => t.startsWith('Work items'));
  const giteaMerge = c.nav.findIndex((t) => t.startsWith('Merge requests'));
  const giteaRepo = c.nav.findIndex((t) => t.startsWith('Repository'));
  check(
    'Codeberg (Gitea) tabs reordered into GitLab’s order',
    giteaWorkItems > -1 && giteaWorkItems < giteaMerge && giteaMerge < giteaRepo,
    `${giteaWorkItems}/${giteaMerge}/${giteaRepo}`,
  );

  // The same site, told to wear the GitHub UI instead.
  await setHostSettings(popup, { 'codeberg.org': 'github' });
  await cb
    .waitForFunction(
      () =>
        document.documentElement.classList.contains('gs-theme-github') &&
        [...document.querySelectorAll('overflow-menu .overflow-menu-items a.item')].some((a) =>
          /^Code\b/.test((a.textContent || '').replace(/\s+/g, ' ').trim()),
        ),
      null,
      { timeout: 45000 },
    )
    .catch(() => {});
  const cg = { nav: await readTabs() };
  check(
    'Codeberg (Gitea) can wear the GitHub UI',
    cg.nav.findIndex((t) => t.startsWith('Code')) === 0 &&
      cg.nav.findIndex((t) => t.startsWith('Issues')) === 1 &&
      cg.nav.findIndex((t) => t.startsWith('Pull requests')) === 2,
    cg.nav.join(', '),
  );
  await cb.close();
  // Clear the per-site choice so it does not leak into the revert check.
  await setHostSettings(popup, {});

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
