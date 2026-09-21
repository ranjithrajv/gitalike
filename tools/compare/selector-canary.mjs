#!/usr/bin/env node
/**
 * Selector canary for gitalike.
 *
 * The skin leans on a handful of anchors in GitHub's, GitLab's and Gitea's
 * markup — `nav[aria-label="Repository"] ul.UnderlineNav-body`, `.super-sidebar`,
 * the profile navigation landmarks, the hashed `PageLayoutContent-` prefix,
 * Gitea's `data-theme` / `#navbar`. The colour mapping rides on design tokens and
 * survives a redesign; these structural hooks do not, and when a forge renames
 * one the skin degrades to "no change" (or, worse, a half-drawn layout) until
 * someone notices.
 *
 * The hooks are not listed here. They live in `src/lib/ux.js` — `SELECTORS` names
 * each hook per source product, `CANARY_PAGES` says which page must still carry
 * which hook — so the canary checks exactly the selectors the skin uses, and a
 * rename is one edit to `SELECTORS` plus one failing check. This fetches the
 * public pages and asserts those anchors are still in the served HTML. It is
 * deliberately a plain `fetch`, not a browser: it checks the markup a forge
 * ships, needs no download, and is cheap enough to run daily. It is the same
 * signal `tools/compare/e2e.mjs` would give, without the live browser.
 *
 *   node tools/compare/selector-canary.mjs
 *
 * A missing hook fails the run. A page that cannot be fetched is a warning, not
 * a failure — an outage should not look like a renamed class — but it is
 * printed so a persistent block is visible.
 */

import '../../src/lib/ux.js';

const UX = globalThis.GITALIKE_UX;
if (!UX?.SELECTORS || !UX?.CANARY_PAGES) {
  console.error('src/lib/ux.js did not publish SELECTORS/CANARY_PAGES');
  process.exit(1);
}

const UA =
  'gitalike-selector-canary/1.0 (+https://github.com/ranjithrajv/gitalike)';

// Turn one selector into the loose substrings a served page would contain.
// Comma-separated selectors are alternatives; within one, every token must be
// present. A tag or bare combinator contributes nothing, so those are ignored —
// the hooks here are classes, ids and attribute values, not structure.
function alternatives(selector) {
  return selector
    .split(',')
    .map((part) => {
      const tokens = [];
      for (const m of part.matchAll(
        /\[\s*([\w-]+)\s*(?:([*^$]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\s*\]/g,
      )) {
        const [, attr, op, dq, sq, bare] = m;
        const value = dq ?? sq ?? bare ?? '';
        // `[attr*="v"]` is a substring match; assert the value alone.
        if (op === '*') tokens.push(value);
        else if (op === '=') tokens.push(`${attr}="${value}"`);
        else tokens.push(attr);
      }
      const stripped = part.replace(/\[[^\]]*\]/g, ' ');
      for (const m of stripped.matchAll(/#([\w-]+)/g))
        tokens.push(`id="${m[1]}"`);
      for (const m of stripped.matchAll(/\.([\w-]+)/g)) tokens.push(m[1]);
      return tokens;
    })
    .filter((tokens) => tokens.length > 0);
}

/** true/false when probeable, null when the selector says nothing to probe. */
function present(html, selector) {
  const alts = alternatives(selector);
  if (!alts.length) return null;
  return alts.some((tokens) => tokens.every((token) => html.includes(token)));
}

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

for (const page of UX.CANARY_PAGES) {
  const source = UX.SELECTORS[page.source];
  if (!source) {
    failed += 1;
    console.error(`FAIL  ${page.name} — no SELECTORS.${page.source}`);
    continue;
  }

  let html;
  try {
    html = await fetchHtml(page.url);
  } catch (error) {
    warned += 1;
    console.warn(
      `WARN  ${page.name} — could not fetch ${page.url}: ${error.message}`,
    );
    continue;
  }

  for (const key of page.keys) {
    const selector = source[key];
    if (!selector) {
      failed += 1;
      console.error(
        `FAIL  ${page.name} — SELECTORS.${page.source}.${key} is missing`,
      );
      continue;
    }
    const ok = present(html, selector);
    if (ok === null) {
      warned += 1;
      console.warn(
        `WARN  ${page.name} — ${key} (${selector}) has nothing to probe`,
      );
    } else if (ok) {
      console.log(`ok    ${page.name} — ${key}`);
    } else {
      failed += 1;
      console.error(`FAIL  ${page.name} — ${key} is gone (${selector})`);
    }
  }
}

console.log(
  `\n${failed} missing hook(s), ${warned} page(s)/hook(s) not checked`,
);
if (failed) {
  console.error(
    '\nA forge changed its markup. Update the selector in src/lib/ux.js\n' +
      '(SELECTORS, and CANARY_PAGES if a page moves) and the theme file it\n' +
      'drives, then rerun.',
  );
  process.exitCode = 1;
}
