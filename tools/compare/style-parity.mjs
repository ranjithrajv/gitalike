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
 *   header  2.0  the top bar's colour matches the target's `--gs-header-bg`
 *   body    1.0  the page background matches the target's `--gs-canvas`
 *   link    2.0  a content link uses the target's `--gs-link`
 *   vocab   2.0  the navigation carries the target's words
 *
 * A colour dimension scores `1 - distance/scale`, so a near-match is near-full
 * credit rather than a fail. The tokens are read from the applied theme's own
 * `--gs-*` variables, so the score measures how completely the skin applied its
 * palette and structure to this source — not whether the palette itself is the
 * right one (that is a property of the theme, held by the unit tests).
 *
 *   node tools/compare/style-parity.mjs            graded table
 *   node tools/compare/style-parity.mjs --checks   the per-dimension detail
 *   node tools/compare/style-parity.mjs --json
 *
 * Live sites, so it is a scheduled/on-demand check, not a commit gate. The
 * Bitbucket and Gerrit *sources* are not driven here: Bitbucket Cloud needs a
 * session and Gerrit has no bundled host.
 */

import { launch, retry, waitForTheme } from './harness.mjs';

// Words that mark a container as the repository navigation, whichever product
// the source or target is, so the right `<ul>` is found without keying on a
// specific source's markup.
const REPO_WORDS = [
  'Code',
  'Repository',
  'Source',
  'Issues',
  'Work items',
  'Pull requests',
  'Merge requests',
  'Actions',
  'CI/CD',
  'Pipelines',
  'Projects',
  'Issue boards',
];

// The source pages, and where their chrome lives. Selector lists resolve in
// order — a rebuilt element wins over a leftover one.
const SOURCES = [
  {
    key: 'github',
    host: 'github.com',
    url: 'https://github.com/git/git',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    header: ['header[role="banner"]', '.AppHeader'],
    nav: [
      'nav[aria-label="Repository"] ul.UnderlineNav-body',
      'nav[aria-label="Repository"] ul',
    ],
    link: ['#readme a[href]', '.markdown-body a[href]', 'main a[href]'],
  },
  {
    key: 'gitlab',
    host: 'gitlab.com',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    ready: '.super-sidebar, [data-testid="project-header"]',
    header: ['header', '.header-content'],
    nav: [
      '[data-gs-project-tabs]',
      '.super-sidebar [data-testid="nav-container"] ul',
      '.super-sidebar ul',
    ],
    link: ['#readme a[href]', '.md a[href]', 'main a[href]'],
  },
  {
    key: 'gitea',
    host: 'codeberg.org',
    url: 'https://codeberg.org/forgejo/forgejo',
    ready: '.repo-header, overflow-menu, [data-gs-gitea-nav]',
    header: ['#navbar'],
    nav: ['[data-gs-gitea-nav]', 'overflow-menu .overflow-menu-items'],
    link: ['#readme a[href]', '.markdown a[href]', 'main a[href]'],
  },
  // Bitbucket is a source too, repainted through its Atlassian `--ds-*` tokens
  // (`themes/gs-tokens.css`) rather than markup selectors. It has no navigation
  // or vocabulary pass yet, so it scores on palette only — the honest gap.
  // Gerrit is not driven here: it has no bundled host, so the extension has no
  // permission to inject on it.
  {
    key: 'bitbucket',
    host: 'bitbucket.org',
    url: 'https://bitbucket.org/atlassian/atlassian-connect-express/src/master/',
    ready: '[data-testid="ref-selector-trigger"]',
    header: ['header[data-layout-slot="true"]', 'header'],
    nav: ['nav', '[data-testid="repo-nav"]'],
    link: ['main a[href]', 'a[href]'],
  },
];

// What each target product's chrome looks like: its navigation shape and the
// words its repository menu carries.
const TARGETS = {
  github: {
    layout: 'row',
    vocab: ['Code', 'Pull requests', 'Actions', 'Insights', 'Projects'],
  },
  gitlab: {
    layout: 'column',
    vocab: [
      'Repository',
      'Merge requests',
      'CI/CD',
      'Analytics',
      'Issue boards',
    ],
  },
  bitbucket: {
    layout: 'column',
    vocab: ['Source', 'Pull requests', 'Pipelines'],
  },
};

// A source never wears its own UI, so these are the real cells.
const SKINS = ['gitlab', 'github', 'bitbucket'];

const WEIGHTS = {
  theme: 1,
  layout: 2,
  header: 2,
  body: 1,
  link: 2,
  vocab: 2,
};
const SCORE_WEIGHT = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

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
// dimension is worth nothing.
const colorFraction = (got, want, scale = 96) => {
  const a = parseColor(got);
  const b = parseColor(want);
  if (!a || !b) return 0;
  return Math.max(0, Math.min(1, 1 - colorDist(a, b) / scale));
};

// Runs in the page: read the chrome's computed styles and vocabulary. Selector
// lists are passed in, so this stays serialisable.
const readChrome = ({ headerSels, navSels, linkSels, repoWords }) => {
  const visible = (el) => el && getComputedStyle(el).display !== 'none';
  const first = (sels, predicate = visible) => {
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (predicate(el)) return el;
      }
    }
    return null;
  };
  const label = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();

  // The repo nav is the best candidate of the first selector that has one: a
  // rebuilt nav (an earlier selector) wins over a leftover hidden sidebar.
  let nav = null;
  for (const sel of navSels) {
    let candidate = null;
    let best = -1;
    for (const el of document.querySelectorAll(sel)) {
      const links = [...el.querySelectorAll('a')].filter(visible);
      const known = links.filter((a) =>
        repoWords.some((word) => label(a).startsWith(word)),
      ).length;
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

  const header = first(headerSels);
  const link = first(linkSels, (el) => visible(el) && label(el).length > 1);
  const root = getComputedStyle(document.documentElement);
  const token = (name) => root.getPropertyValue(name).trim();
  const labels = nav
    ? [...nav.querySelectorAll('a')].filter(visible).map(label).filter(Boolean)
    : [];
  return {
    theme: [...document.documentElement.classList].find((c) =>
      c.startsWith('gs-theme-'),
    ),
    navDisplay: nav ? getComputedStyle(nav).display : null,
    navDirection: nav ? getComputedStyle(nav).flexDirection : null,
    headerBg: header ? getComputedStyle(header).backgroundColor : null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    linkColor: link ? getComputedStyle(link).color : null,
    labels,
    tokens: {
      header: token('--gs-header-bg'),
      canvas: token('--gs-canvas'),
      link: token('--gs-link') || token('--gs-accent'),
    },
  };
};

const { context, setSettings, setHostSettings, close } = await launch({
  viewport: { width: 1280, height: 900 },
  headless: true,
  profilePrefix: 'gs-style-',
});

const gotoLive = (page, url) =>
  retry(() =>
    page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
  );

const rows = [];

try {
  await setSettings({ github: 'off', gitlab: 'off' });

  for (const source of SOURCES) {
    for (const skin of SKINS) {
      // A source never wears its own UI — `themeFor` returns null there.
      if (skin === source.key) continue;
      await setHostSettings({ [source.host]: skin });
      const page = await context.newPage();
      await gotoLive(page, source.url);
      await page
        .waitForSelector(source.ready, { timeout: 30000 })
        .catch(() => {});
      await waitForTheme(page, skin).catch(() => {});
      await page.waitForTimeout(2500);
      const chrome = await page.evaluate(readChrome, {
        headerSels: source.header,
        navSels: source.nav,
        linkSels: source.link,
        repoWords: REPO_WORDS,
      });
      await page.close();

      const target = TARGETS[skin];
      const horizontal =
        chrome.navDisplay === 'flex' && chrome.navDirection === 'row';
      const found = chrome.labels.map((l) => l.replace(/\s+/g, ' ').trim());
      const vocab =
        target.vocab.filter((word) => found.some((l) => l.startsWith(word)))
          .length / target.vocab.length;

      const dims = {
        theme: chrome.theme === `gs-theme-${skin}` ? 1 : 0,
        layout: (horizontal ? 'row' : 'column') === target.layout ? 1 : 0,
        header: colorFraction(chrome.headerBg, chrome.tokens.header),
        body: colorFraction(chrome.bodyBg, chrome.tokens.canvas),
        link: colorFraction(chrome.linkColor, chrome.tokens.link),
        vocab,
      };
      const score =
        Object.entries(WEIGHTS).reduce(
          (sum, [key, weight]) => sum + weight * dims[key],
          0,
        ) / SCORE_WEIGHT;

      rows.push({ cell: `${source.key} → ${skin}`, score, dims, chrome });
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
  for (const { cell, dims, chrome } of rows) {
    console.log(
      `${cell.padEnd(22)}  theme ${dims.theme} | layout ${dims.layout} | ` +
        `header ${dims.header?.toFixed(2)} | body ${dims.body?.toFixed(2)} | ` +
        `link ${dims.link?.toFixed(2)} | vocab ${dims.vocab?.toFixed(2)}  ` +
        `[${chrome.labels?.slice(0, 8).join(', ')}]`,
    );
  }
} else {
  const pad = (n) => String(n).padEnd(22);
  console.log(
    `\n${'score'.padStart(5)}  ${pad('source → skin')}  theme layout header body link vocab\n`,
  );
  for (const { cell, score, dims } of rows) {
    const f = (v) => (v === undefined ? '  -  ' : v.toFixed(2).padStart(5));
    console.log(
      `${(score * 10).toFixed(1).padStart(5)}  ${pad(cell)}  ${f(dims.theme)}  ${f(dims.layout)}   ${f(dims.header)} ${f(dims.body)} ${f(dims.link)} ${f(dims.vocab)}`,
    );
  }
}

// A clear regression is a real cell where the skin did not apply at all. Low
// scores are reported but do not fail the run — the Bitbucket source is
// palette-only by design, and a source may simply lack a tab the target has.
if (rows.some((row) => row.dims && row.dims.theme === 0)) process.exitCode = 1;
