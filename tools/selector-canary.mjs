#!/usr/bin/env node
/**
 * Selector canary for gitalike.
 *
 * The skin leans on a handful of anchors in GitHub's, GitLab's and Gitea's
 * markup — `nav[aria-label="Repository"] ul.UnderlineNav-body`, `.super-sidebar`,
 * the profile navigation landmarks, the hashed `PageLayoutContent-*` prefix,
 * Gitea's `data-theme` / `#navbar`. The colour mapping rides on design tokens and
 * survives a redesign; these structural hooks do not, and when a forge renames
 * one the skin degrades to "no change" (or, worse, a half-drawn layout) until
 * someone notices.
 *
 * This fetches the public pages the skins are verified against and asserts the
 * anchors are still in the served HTML. It is deliberately a plain `fetch`, not
 * a browser: it checks the markup a forge ships, needs no download, and is
 * cheap enough to run daily. It is the same signal `tools/e2e.mjs` would give,
 * without the live browser.
 *
 *   node tools/selector-canary.mjs
 *
 * A missing hook fails the run. A page that cannot be fetched is a warning, not
 * a failure — an outage should not look like a renamed class — but it is
 * printed so a persistent block is visible.
 *
 * The hooks mirror the selectors named in `src/lib/ux.js` (NAV_SCOPE, NAV_RULES)
 * and `src/content/ux.js` / `src/themes/*.css`; update both together.
 */

const UA =
  'gitalike-selector-canary/1.0 (+https://github.com/ranjithrajv/gitalike)';

const PAGES = [
  {
    name: 'GitHub repository page',
    url: 'https://github.com/git/git',
    hooks: [
      ['repo tab list', /UnderlineNav-body/],
      ['repo nav landmark', /aria-label="Repository"/],
      ['metadata sidebar prefix', /PageLayoutContent-/],
      ['app/marketing header', /AppHeader|role="banner"/],
    ],
  },
  {
    name: 'GitHub profile page',
    url: 'https://github.com/torvalds',
    hooks: [
      ['profile nav landmark', /aria-label="User profile"/],
      ['profile frame', /user-profile-frame/],
    ],
  },
  {
    name: 'GitLab project page',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    hooks: [
      ['super sidebar', /class="[^"]*\bsuper-sidebar\b/],
      ['project sidebar block', /project-page-sidebar-block/],
    ],
  },
  {
    name: 'GitLab profile page',
    url: 'https://gitlab.com/dzaporozhets',
    hooks: [
      ['super sidebar', /class="[^"]*\bsuper-sidebar\b/],
      ['profile header', /user-profile-header/],
      ['profile sidebar', /user-profile-sidebar/],
    ],
  },
  {
    name: 'Codeberg (Forgejo) project page',
    url: 'https://codeberg.org/forgejo/forgejo',
    hooks: [
      ['theme marker', /data-theme="/],
      ['top bar', /id="navbar"/],
      ['repo header', /class="[^"]*\brepo-header\b/],
    ],
  },
  {
    name: 'Codeberg (Forgejo) pull requests',
    url: 'https://codeberg.org/forgejo/forgejo/pulls',
    hooks: [
      ['theme marker', /data-theme="/],
      ['numeric pull links', /\/pulls\/\d+/],
    ],
  },
];

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': UA, accept: 'text/html' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

let failed = 0;
let warned = 0;

for (const page of PAGES) {
  let html;
  try {
    html = await fetchHtml(page.url);
  } catch (error) {
    warned += 1;
    console.warn(`WARN  ${page.name} — could not fetch ${page.url}: ${error.message}`);
    continue;
  }

  for (const [label, pattern] of page.hooks) {
    if (pattern.test(html)) {
      console.log(`ok    ${page.name} — ${label}`);
    } else {
      failed += 1;
      console.error(`FAIL  ${page.name} — ${label} is gone (${pattern})`);
    }
  }
}

console.log(`\n${failed} missing hook(s), ${warned} page(s) unreachable`);
if (failed) {
  console.error(
    '\nA forge changed its markup. Check src/lib/ux.js and src/themes/*.css\n' +
      'for the selector, then update it and the hooks above together.',
  );
  process.exitCode = 1;
}
