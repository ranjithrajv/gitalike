#!/usr/bin/env node
/**
 * Layout parity: does a skinned page actually sit in the layout its skin claims?
 *
 * `style-parity.mjs` scores layout as one weighted dimension; this is the
 * dedicated, gating read. A skin declares a `layout` ('github' = top bar plus a
 * horizontal tab row, 'gitlab' = left sidebar), the content script mirrors it as
 * `html.gs-layout-<layout>`, and the structural passes reorient the navigation
 * to match. This checks, for every source × skin, that:
 *
 *   - the page carries the skin's `gs-layout-*` class;
 *   - the navigation is oriented the way that layout is (row / column);
 *   - the profile pages put the menu in the layout's shape.
 *
 * A source only has its navigation or profile reoriented if it declared the
 * capability (`compare.nav` / `compare.profile`), so pairs without it are
 * reported `n/a` rather than failed — Gerrit's shadow DOM, for instance, is
 * palette-only. The group-heading and profile-rail counts are reported for
 * context but not gated: grouping is a per-skin, per-source decision, not the
 * orientation this checks.
 *
 *   node tools/compare/layout-parity.mjs            pass/fail tables
 *   node tools/compare/layout-parity.mjs --json     machine-readable rows
 *
 * Exits non-zero when a gated pair fails. Needs the built extension
 * (`npm run build:chromium`) and the network, like the other live reads.
 */
import { launch, retry, waitForTheme } from './harness.mjs';
import '../plugins.mjs';
import { SOURCES as CAPTURE_SOURCES } from './captures.mjs';
import { PROJECT_SELECTORS, PROFILE_SELECTORS } from './style-recipes.mjs';

const PLUGINS = globalThis.GITALIKE_PLUGINS;
const SITES = globalThis.GITALIKE;
const SKINS = Object.keys(PLUGINS.skins);

// A source that is not a bundled host (Gerrit) is granted and registered as its
// kind for this run only; the shipped extension's permissions are unchanged.
const instanceSources = CAPTURE_SOURCES.filter((source) => source.instance);
const grantedHosts = instanceSources.map((source) => source.instance.host);
const instances = Object.fromEntries(
  instanceSources.map((source) => [source.instance.host, source.instance.kind]),
);

const cap = (source) => PLUGINS.sources[source].compare;

// Read the layout signals on the page. Runs in the page, so it stays
// serialisable; `navSels` is the page type's navigation selector list.
const readLayout = ({ navSels }) => {
  // PolyGerrit renders inside open shadow roots, so descend into them.
  const deepAll = (sel) => {
    const out = [];
    const walk = (scope) => {
      for (const el of scope.querySelectorAll(sel)) out.push(el);
      for (const el of scope.querySelectorAll('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return out;
  };
  const visible = (el) => el && getComputedStyle(el).display !== 'none';
  let nav = null;
  for (const sel of navSels) {
    for (const el of deepAll(sel)) {
      if (visible(el)) {
        nav = el;
        break;
      }
    }
    if (nav) break;
  }
  const style = nav ? getComputedStyle(nav) : null;
  return {
    layoutClasses: [...document.documentElement.classList].filter((name) =>
      name.startsWith('gs-layout-'),
    ),
    navDisplay: style?.display ?? null,
    navDirection: style?.flexDirection ?? null,
    groups: document.querySelectorAll('.gs-nav-group').length,
    profileRail: Boolean(document.querySelector('[data-gs-profile-rail]')),
    profileStats: Boolean(document.querySelector('[data-gs-profile-stats]')),
  };
};

const PAGES = [
  { type: 'project', selectors: PROJECT_SELECTORS },
  { type: 'profile', selectors: PROFILE_SELECTORS },
];

const sourcesFor = (page) =>
  CAPTURE_SOURCES.map((source) => ({
    ...source,
    ...page.selectors[source.key],
  }));

const { context, setSettings, setHostSettings, setInstances, close } =
  await launch({
    viewport: { width: 1280, height: 900 },
    headless: true,
    profilePrefix: 'gs-layout-',
    hosts: grantedHosts,
  });

const rows = [];

try {
  if (Object.keys(instances).length) await setInstances(instances);
  await setSettings({ github: 'off', gitlab: 'off' });

  for (const page of PAGES) {
    for (const source of sourcesFor(page)) {
      for (const skin of SKINS) {
        if (skin === source.key) continue; // a source never wears its own UI
        await setHostSettings({ [source.host]: skin });
        const tab = await context.newPage();
        await retry(() =>
          tab.goto(source.url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
          }),
        );
        await tab
          .waitForSelector(source.ready, { timeout: 30000 })
          .catch(() => {});
        await waitForTheme(tab, skin).catch(() => {});
        await tab.waitForTimeout(2000);
        const got = await tab.evaluate(readLayout, { navSels: source.nav });
        await tab.close();

        const layout = SITES.skins[skin].layout;
        const expectedOrientation = layout === 'github' ? 'row' : 'column';
        const horizontal =
          got.navDisplay === 'flex' && got.navDirection === 'row';
        const orientation = horizontal ? 'row' : 'column';
        const hasLayoutClass = got.layoutClasses.includes(
          `gs-layout-${layout}`,
        );
        // The capability decides whether the pair is gated: a source with no
        // navigation pass is not expected to be oriented, and is reported n/a.
        const gated =
          page.type === 'project'
            ? cap(source.key).nav > 0
            : cap(source.key).profile > 0;
        const pass =
          hasLayoutClass && (!gated || orientation === expectedOrientation);
        rows.push({
          page: page.type,
          cell: `${source.key} → ${skin}`,
          layout,
          hasLayoutClass,
          expectedOrientation,
          orientation,
          gated,
          groups: got.groups,
          profileRail: got.profileRail,
          profileStats: got.profileStats,
          pass,
        });
      }
    }
  }
} catch (error) {
  rows.push({ page: 'run', cell: 'run', pass: false, error: error.message });
} finally {
  await close();
}

const failures = rows.filter((row) => row.error || !row.pass);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  for (const type of ['project', 'profile']) {
    console.log(
      `\n${type === 'project' ? 'Project' : 'Profile'} pages — layout parity\n`,
    );
    console.log(
      'verdict  source → skin          gs-layout  orientation (want)  groups  profile  ',
    );
    console.log(
      '-------  ---------------------  ---------  ------------------  ------  -------  ',
    );
    for (const row of rows.filter((r) => r.page === type)) {
      const verdict = row.pass ? 'PASS' : 'FAIL';
      const layout = row.hasLayoutClass ? 'ok' : 'missing';
      const orientation = !row.gated
        ? `n/a${row.orientation ? ` (${row.orientation})` : ''}`
        : `${row.orientation} (${row.expectedOrientation})`;
      const profile = row.profileRail
        ? 'rail'
        : row.profileStats
          ? 'stats'
          : '-';
      console.log(
        `${verdict.padEnd(7)}  ${row.cell.padEnd(21)}  ${layout.padEnd(9)}  ` +
          `${orientation.padEnd(18)}  ${String(row.groups).padEnd(6)}  ${profile.padEnd(7)}`,
      );
    }
  }
  const passing = rows.length - failures.length;
  const rate = rows.length ? Math.round((passing / rows.length) * 100) : 0;
  console.log(
    `\n${passing}/${rows.length} pairs passing — layout parity ${rate}%` +
      (failures.length
        ? ` (failing: ${failures.map((r) => r.cell).join(', ')})`
        : ''),
  );
}

if (failures.length) process.exitCode = 1;
