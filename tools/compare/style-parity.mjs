#!/usr/bin/env node
/**
 * Computed-style parity, graded: the content-free fidelity score.
 *
 * The pixel tools cannot be robust — a skinned page and a target reference are
 * different repositories, so content dominates any SSIM, and the reference
 * captures disagree with the skins on the target's own chrome (see
 * `parity-style.mjs`). This tool sidesteps content entirely: it loads each source
 * page, applies a skin, and reads the *computed styles and vocabulary* of the
 * chrome the skin is supposed to have changed.
 *
 * Each (source, skin) cell is scored 0–10 from weighted dimensions, each a
 * fraction in [0, 1] — no binary pass/fail:
 *
 *   theme   1.0  the skin's class is on <html> (a gate: 0 fails the cell)
 *   layout  2.0  the repo navigation is oriented as the target is
 *   header  2.0  the top bar's colour matches the target product's real header
 *   body    1.0  the page's canvas matches the target product's canvas
 *   link    2.0  a content link uses the target product's link / accent
 *   vocab   2.0  the navigation carries the target's words
 *
 * A colour dimension scores `1 - distance/scale`, so a near-match is near-full
 * credit rather than a fail. The expected colours come from the reviewed
 * `tests/fixtures/target-chrome.json`, NOT the applied theme's own `--gs-*`
 * variables, so the score measures fidelity to the product rather than
 * self-consistency; `tests/compare/target-chrome.test.mjs` pins the skins to the
 * fixture offline.
 *
 *   node tools/compare/style-parity.mjs            graded table
 *   node tools/compare/style-parity.mjs --checks   the per-dimension detail
 *   node tools/compare/style-parity.mjs --json
 *
 * Live sites, so it is a scheduled/on-demand check, not a commit gate. Gerrit
 * has no bundled host, so the run grants it one for the duration.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch, retry, waitForTheme } from './harness.mjs';
import { SOURCES as CAPTURE_SOURCES } from './captures.mjs';
import {
  PROJECT_SELECTORS,
  PROFILE_SELECTORS,
  PROJECT_VOCAB,
  PROFILE_VOCAB,
} from './style-recipes.mjs';
import '../plugins.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SITES = globalThis.GITALIKE;

// The skins are the registry's, not a hand-kept list. (The capture coverage is
// checked where the recipes live, in `captures.mjs`, so this tool and
// `parity-visual`/`parity-style` all refuse to run an uncaptured source.)
const SKINS = Object.keys(PLUGINS.skins);

// A source that is not a bundled host (Gerrit) is granted and registered as its
// kind for this run only, so the shipped extension's permissions are unchanged.
const instanceSources = CAPTURE_SOURCES.filter((source) => source.instance);
const grantedHosts = instanceSources.map((source) => source.instance.host);
const instances = Object.fromEntries(
  instanceSources.map((source) => [source.instance.host, source.instance.kind]),
);

// The reviewed, skin-independent reference: the target products' real chrome
// colours. Scoring against these — not the applied skin's own `--gs-*`
// variables — is what makes the score a fidelity measure rather than a
// self-consistency check. `tests/compare/target-chrome.test.mjs` pins the skins'
// light palettes to the same fixture offline.
const TARGET_CHROME = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/target-chrome.json'), 'utf8'),
).products;

// Words that mark a container as the repository navigation, whichever product
// the source or target is, so the right `<ul>` is found without keying on a
// specific source's markup.
const REPO_WORDS = [
  'Code',
  'Repository',
  'Source',
  'Commits',
  'Branches',
  'Tags',
  'Issues',
  'Work items',
  'Pull requests',
  'Merge requests',
  'Actions',
  'CI/CD',
  'Pipelines',
  'Deployments',
  'Downloads',
  'Projects',
  'Issue boards',
  'Security',
];

const PROJECT_SOURCES = CAPTURE_SOURCES.map((source) => ({
  key: source.key,
  host: source.host,
  ...PROJECT_SELECTORS[source.key],
}));

const PROFILE_SOURCES = PROJECT_SOURCES.map((source) => ({
  ...source,
  ...PROFILE_SELECTORS[source.key],
}));

// Words that mark a container as the profile navigation, so the right `<ul>` is
// found whichever product the source or target is.
const PROFILE_WORDS = [
  'Overview',
  'Repositories',
  'Projects',
  'Packages',
  'Stars',
  'Activity',
  'Groups',
  'Snippets',
  'Followers',
  'Following',
  'Personal projects',
  'Contributed projects',
  'Starred projects',
];

const targetFor = (skin, vocab) => ({
  layout: SITES.skins[skin].layout === 'github' ? 'row' : 'column',
  vocab: vocab[skin],
});

const TARGETS = {
  project: Object.fromEntries(
    SKINS.map((skin) => [skin, targetFor(skin, PROJECT_VOCAB)]),
  ),
  profile: Object.fromEntries(
    SKINS.map((skin) => [skin, targetFor(skin, PROFILE_VOCAB)]),
  ),
};

const PAGES = [
  { type: 'project', sources: PROJECT_SOURCES, navWords: REPO_WORDS },
  { type: 'profile', sources: PROFILE_SOURCES, navWords: PROFILE_WORDS },
];

const WEIGHTS = {
  theme: 1,
  layout: 2,
  header: 2,
  body: 1,
  link: 2,
  vocab: 2,
};

const parseColor = (value) => {
  if (!value) return null;
  const rgb = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!hex) return null;
  const h = hex[1];
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const colorDist = (a, b) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

// A near-match earns near-full credit; `scale` is the distance at which the
// dimension is worth nothing. Returns null when a colour is missing, so the
// caller can drop the dimension rather than score a false zero.
const colorFraction = (got, want, scale = 96) => {
  const a = parseColor(got);
  const b = parseColor(want);
  if (!a || !b) return null;
  return Math.max(0, Math.min(1, 1 - colorDist(a, b) / scale));
};

// Runs in the page: read the chrome's computed styles and vocabulary. Selector
// lists are passed in, so this stays serialisable.
const readChrome = ({
  headerSels,
  navSels,
  linkSels,
  canvasSels,
  repoWords,
}) => {
  const visible = (el) => el && getComputedStyle(el).display !== 'none';
  // PolyGerrit renders inside open shadow roots, so a query must descend into
  // them; a plain document.querySelectorAll stops at the host.
  const deepAll = (sel) => {
    const out = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll(sel)) out.push(el);
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return out;
  };
  const first = (sels, predicate = visible) => {
    for (const sel of sels) {
      for (const el of deepAll(sel)) {
        if (predicate(el)) return el;
      }
    }
    return null;
  };
  const label = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

  // The effective background of an element: its own, or the nearest ancestor's
  // (crossing shadow boundaries), because a client-rendered app often paints on
  // an inner node and leaves <body> transparent. This is what the target's
  // canvas is compared against.
  const effectiveBg = (el) => {
    let node = el;
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
      node = node.parentElement || node.getRootNode()?.host || null;
    }
    return getComputedStyle(document.body).backgroundColor;
  };

  // A nav item is a link, button, menu item or tab: Bitbucket's repository bar
  // is buttons, not links.
  const ITEMS =
    'a, button, [role="menuitem"], [role="tab"], [role="link"], span';
  const itemLabels = (root) =>
    [...root.querySelectorAll(ITEMS)]
      .filter(visible)
      .map(label)
      .filter(Boolean);
  const knownIn = (root) =>
    itemLabels(root).filter((text) =>
      repoWords.some((word) => text.startsWith(word)),
    ).length;

  // The repo nav is the best candidate of the first selector that has one: a
  // rebuilt nav (an earlier selector) wins over a leftover hidden sidebar.
  let nav = null;
  for (const sel of navSels) {
    let candidate = null;
    let best = 0;
    for (const el of deepAll(sel)) {
      const known = knownIn(el);
      if (known > best) {
        best = known;
        candidate = el;
      }
    }
    if (candidate && best >= 1) {
      nav = candidate;
      break;
    }
  }

  // Fallback for a source whose markup we cannot select — Bitbucket's classes
  // are hashed. Take the ancestor that holds the most known repo words.
  if (!nav) {
    const counts = new Map();
    for (const el of deepAll(ITEMS)) {
      const text = label(el);
      if (!text || !repoWords.some((word) => text.startsWith(word))) continue;
      if (el.querySelector(ITEMS)) continue;
      for (
        let parent = el.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        counts.set(parent, (counts.get(parent) || 0) + 1);
      }
    }
    let best = 1;
    for (const [el, count] of counts) {
      if (count > best) {
        best = count;
        nav = el;
      }
    }
  }

  const header = first(headerSels);
  // Every content link, so the score can take the best match rather than
  // whichever happens to render first.
  const links = [];
  for (const sel of linkSels) {
    for (const el of deepAll(sel)) {
      if (!visible(el) || label(el).length < 2) continue;
      links.push(el);
    }
  }
  const root = getComputedStyle(document.documentElement);
  const token = (name) => root.getPropertyValue(name).trim();
  const labels = nav ? itemLabels(nav) : [];
  return {
    theme: [...document.documentElement.classList].find((c) =>
      c.startsWith('gs-theme-'),
    ),
    navDisplay: nav ? getComputedStyle(nav).display : null,
    navDirection: nav ? getComputedStyle(nav).flexDirection : null,
    headerBg: header ? getComputedStyle(header).backgroundColor : null,
    // The page's canvas: the first declared canvas element (falling back to
    // <body>), read through any transparent wrapper to its real background.
    canvasBg: effectiveBg(first(canvasSels ?? ['body']) ?? document.body),
    linkColors: links.slice(0, 16).map((el) => getComputedStyle(el).color),
    labels,
    tokens: {
      header: token('--gs-header-bg'),
      canvas: token('--gs-canvas'),
      link: token('--gs-link'),
      accent: token('--gs-accent'),
    },
  };
};

const { context, setSettings, setHostSettings, setInstances, close } =
  await launch({
    viewport: { width: 1280, height: 900 },
    headless: true,
    profilePrefix: 'gs-style-',
    hosts: grantedHosts,
  });

const gotoLive = (page, url) =>
  retry(() =>
    page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
  );

const rows = [];

try {
  if (Object.keys(instances).length) await setInstances(instances);
  await setSettings({ github: 'off', gitlab: 'off' });

  for (const page of PAGES) {
    for (const source of page.sources) {
      for (const skin of SKINS) {
        // A source never wears its own UI — `themeFor` returns null there.
        if (skin === source.key) continue;
        await setHostSettings({ [source.host]: skin });
        const tab = await context.newPage();
        await gotoLive(tab, source.url);
        await tab
          .waitForSelector(source.ready, { timeout: 30000 })
          .catch(() => {});
        await waitForTheme(tab, skin).catch(() => {});
        await tab.waitForTimeout(2500);
        const chrome = await tab.evaluate(readChrome, {
          headerSels: source.header,
          navSels: source.nav,
          linkSels: source.link,
          canvasSels: source.canvas ?? ['body'],
          repoWords: page.navWords,
        });
        await tab.close();

        const target = TARGETS[page.type][skin];
        const horizontal =
          chrome.navDisplay === 'flex' && chrome.navDirection === 'row';
        const found = chrome.labels.map((l) => l.replace(/\s+/g, ' ').trim());
        const vocab =
          target.vocab.filter((word) => found.some((l) => l.startsWith(word)))
            .length / target.vocab.length;

        // The reviewed target chrome, not the skin's own tokens — see the
        // fixture. A link carries the link colour on content and the accent on
        // a nav item, so either is a match; with no link on the page the
        // dimension is dropped rather than scored zero.
        const expect = TARGET_CHROME[skin];
        const linkFractions = (chrome.linkColors || [])
          .flatMap((color) => [
            colorFraction(color, expect.link),
            colorFraction(color, expect.accent),
          ])
          .filter((value) => value !== null);

        const dims = {
          theme: chrome.theme === `gs-theme-${skin}` ? 1 : 0,
          layout: (horizontal ? 'row' : 'column') === target.layout ? 1 : 0,
          header: colorFraction(chrome.headerBg, expect.header),
          body: colorFraction(chrome.canvasBg, expect.canvas),
          link: linkFractions.length ? Math.max(...linkFractions) : null,
          vocab,
        };
        // Score over the dimensions that apply, so a page without a link is not
        // penalised for it.
        const applicable = Object.entries(WEIGHTS).filter(
          ([key]) => dims[key] !== null && dims[key] !== undefined,
        );
        const score =
          applicable.reduce(
            (sum, [key, weight]) => sum + weight * dims[key],
            0,
          ) / applicable.reduce((sum, [, weight]) => sum + weight, 0);

        rows.push({
          page: page.type,
          source: source.key,
          cell: `${source.key} → ${skin}`,
          score,
          dims,
          chrome,
        });
      }
    }
  }
} catch (error) {
  rows.push({
    cell: 'run',
    score: 0,
    dims: {},
    chrome: { error: error.message },
  });
} finally {
  await close();
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else if (process.argv.includes('--checks')) {
  const fmt = (v) => (v == null ? '-' : v.toFixed(2));
  for (const { page, cell, dims, chrome } of rows) {
    console.log(
      `${page ?? 'run'}  ${cell.padEnd(22)}  theme ${dims.theme} | layout ${dims.layout} | ` +
        `header ${fmt(dims.header)} | body ${fmt(dims.body)} | ` +
        `link ${fmt(dims.link)} | vocab ${fmt(dims.vocab)}  ` +
        `[${chrome.labels?.slice(0, 8).join(', ')}]`,
    );
  }
} else {
  const pad = (n) => String(n).padEnd(22);
  for (const page of PAGES) {
    console.log(
      `\n${page.type === 'project' ? 'Project' : 'Profile'} pages — graded computed-style parity\n`,
    );
    console.log(
      `${'score'.padStart(5)}  ${pad('source → skin')}  theme layout header body link vocab\n`,
    );
    for (const { page: type, cell, score, dims } of rows) {
      if (type !== page.type) continue;
      const f = (v) => (v == null ? '  -  ' : v.toFixed(2).padStart(5));
      console.log(
        `${(score * 10).toFixed(1).padStart(5)}  ${pad(cell)}  ${f(dims.theme)}  ${f(dims.layout)}   ${f(dims.header)} ${f(dims.body)} ${f(dims.link)} ${f(dims.vocab)}`,
      );
    }
  }
}

// The gate: a cell fails when the skin did not apply at all, or when the chrome
// it applied is the wrong colour — header or canvas below half credit against
// the reviewed target. Vocabulary and layout are reported but not gated, because
// a source may legitimately lack a tab or a shape the target has. The Bitbucket
// source is palette-only, which the colour dimensions still measure.
const FLOOR = 0.5;
// A source that declares only partial palette coverage (Gerrit's shadow-DOM
// app, say) is reported but not floored on the colours: the gate is for a skin
// that did not apply, or painted the chrome wrong on a source it can reach.
const PALETTE_FLOOR = 0.9;
const paletteCoverage = (source) =>
  PLUGINS.sources[source]?.compare?.palette ?? 1;
if (
  rows.some(
    (row) =>
      row.dims &&
      (row.dims.theme === 0 ||
        (paletteCoverage(row.source) >= PALETTE_FLOOR &&
          (row.dims.header < FLOOR || row.dims.body < FLOOR))),
  )
) {
  process.exitCode = 1;
}
