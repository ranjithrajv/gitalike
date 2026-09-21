#!/usr/bin/env node
/**
 * UX parity scoring for GitAlike.
 *
 * The docs quote a score for every source × skin pair — how much of the
 * imitated product's surface the skin reproduces — and this is the one place
 * that number is computed. It derives each dimension from the shared tables in
 * `src/lib/ux.js` and the paint gating in `src/content/ux-*.js`, so changing a
 * table (adding a Bitbucket shortcut table, wiring a Gitea profile pass) moves
 * the score instead of leaving the docs stale. `tests/parity-score.test.mjs`
 * fails if `docs/UX-PARITY.md` and this module disagree.
 *
 * A score is a weighted share out of 10: the rubric holds dimensions with
 * integer weights summing to 100, each dimension returns the fraction of itself
 * the skin reproduces (0–1), and the score is the weighted sum ÷ 10. A pair
 * whose source already *is* the skin scores 10 — it is the reference the skin is
 * measured against.
 *
 *   node tools/compare/parity-score.mjs            markdown tables
 *   node tools/compare/parity-score.mjs --detail   tables plus a per-dimension breakdown
 *   node tools/compare/parity-score.mjs --json     machine-readable scores
 *
 * The fractions are declarative where a table does not encode the answer (a
 * Bitbucket profile has no captured reference, so its credit is partial); those
 * constants carry the reason inline. What is derived, and what a change to the
 * code will move, is anything read from `UX`/`SITES`: nav rules, keep/hide
 * lists, group layouts, the shortcut tables, the profile menu and the metadata
 * pass coverage.
 */

import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';

import '../../src/lib/sites.js';
import '../../src/lib/ux.js';

const SITES = globalThis.GITALIKE;
const UX = globalThis.GITALIKE_UX;
if (!SITES?.skins || !UX?.NAV) {
  console.error('src/lib/sites.js and src/lib/ux.js did not publish');
  process.exit(1);
}

/** The markup families a host can be built on. */
export const SOURCES = [
  { key: 'github', label: 'GitHub' },
  { key: 'gitlab', label: 'GitLab' },
  { key: 'gitea', label: 'Gitea / Forgejo' },
  { key: 'bitbucket', label: 'Bitbucket' },
  { key: 'gerrit', label: 'Gerrit' },
];

/** The target UIs a source can wear. */
export const SKINS = [
  { key: 'github', label: 'GitHub UI' },
  { key: 'gitlab', label: 'GitLab UI' },
  { key: 'bitbucket', label: 'Bitbucket UI' },
];

/**
 * Sources the skins have structural coverage for: a token block re-points their
 * CSS variables and `SELECTORS`/`NAV_RULES` hook their navigation. Gitea has
 * both; Bitbucket Cloud and Gerrit are client-rendered SPAs with no capturable
 * public page, so they are wired only for the source-agnostic passes (copy,
 * control labels, reference markers) and their structural dimensions are
 * credited a token amount rather than 1.
 */
const NO_MARKUP = new Set(['bitbucket', 'gerrit']);
const hasMarkup = (source) => !NO_MARKUP.has(source);

/**
 * Sources whose design tokens the skins re-point. Palette coverage is broader
 * than structural coverage: Bitbucket Cloud exposes Atlassian's `--ds-*` tokens
 * on <html>, so the GitHub and GitLab skins repaint it from the token layer
 * (see gs-tokens.css) even though no Bitbucket selector or nav rule exists.
 * Gerrit exposes no such token layer, so its palette stays near zero.
 */
const NO_PALETTE = new Set(['gerrit']);
const hasPalette = (source) => !NO_PALETTE.has(source);

/**
 * How much of a `g`-combo remap works for a source under a skin. GitHub honours
 * synthetic key events, so a destination with no link still replays; GitLab
 * rejects them (`event.isTrusted`), so only combos with a click target land;
 * Gitea's and Bitbucket's combos are deliberately left alone (their product is
 * neither).
 */
function shortcutsShare(source, skin, native = false) {
  // A source on its own UI already replays its own combos: nothing to remap.
  if (native) return 1;
  const combos = Object.keys(UX.SHORTCUTS[skin] || {});
  if (!combos.length) return 0;
  const expected = skin === 'github' ? 'gitlab' : 'github';
  if (source !== expected) return 0;
  if (source === 'github') return 1;
  const reachable = combos.filter(
    (combo) => UX.SHORTCUT_TARGETS[skin]?.[combo],
  ).length;
  return reachable / combos.length;
}

/**
 * Project-page rubric. Weights sum to 100; every share reads `UX` unless the
 * comment says otherwise.
 */
const PROJECT = [
  {
    key: 'palette',
    weight: 12,
    share: ({ source, native }) => (native ? 1 : hasPalette(source) ? 1 : 0.2),
  },
  {
    key: 'orientation',
    weight: 18,
    // Gitea rebuilds its nav for the GitLab layout (`paintGiteaNav`); for the
    // GitHub layout it only restyles the existing row in place, which is not a
    // full re-orientation. A Bitbucket source has no structural pass at all.
    share: ({ source, layout, native }) =>
      native
        ? 1
        : !hasMarkup(source)
          ? 0.2
          : source === 'gitea' && layout === 'github'
            ? 0.9
            : 1,
  },
  {
    key: 'navLabels',
    weight: 10,
    // A label is matched inside a nav region, so a source with no hooked nav
    // region (Bitbucket) gets none of its words relabelled.
    share: ({ skin, source, native }) =>
      native
        ? 1
        : hasMarkup(source) && Object.keys(UX.NAV[skin] || {}).length
          ? 1
          : 0,
  },
  {
    key: 'navOrder',
    weight: 8,
    // A rule exists per source, so a source with no rule is not reordered at
    // all. Every skin carries a rule for the sources it has markup for.
    share: ({ skin, source, native }) =>
      native ||
      (UX.NAV_RULES[skin] || []).some((rule) => rule.source === source)
        ? 1
        : 0,
  },
  {
    key: 'navGroups',
    weight: 6,
    // GitLab groups its sidebar; GitHub and Bitbucket are flat. Grouping follows
    // the skin in every path. A Bitbucket source keeps its own flat menu, which
    // matches the flat skins but not GitLab's groups.
    share: ({ skin, source, native }) =>
      native ? 1 : !hasMarkup(source) ? (skin === 'gitlab' ? 0 : 1) : 1,
  },
  {
    key: 'navKeep',
    weight: 10,
    // A whitelist means the applied product's own menu exactly. A source with
    // no hooked nav region (Bitbucket) filters nothing.
    share: ({ skin, source, native }) => {
      if (native) return 1;
      if (!hasMarkup(source)) return 0.2;
      return UX.NAV_KEEP[skin] ? 1 : UX.NAV_HIDE[skin] ? 0.7 : 0;
    },
  },
  {
    key: 'metadata',
    weight: 12,
    // The metadata passes target GitHub's About and GitLab's Project
    // information; Gitea and Bitbucket keep their own placement. A Bitbucket
    // *target* has no captured metadata shape, so the move is GitLab's.
    share: ({ source, skin, native }) =>
      native
        ? 1
        : source === 'gitea' || !hasMarkup(source)
          ? 0.2
          : skin === 'bitbucket'
            ? 0.5
            : 1,
  },
  {
    key: 'controlLabels',
    weight: 6,
    // Control labels are matched page-wide, so they work on any markup; the
    // wording tables are target-specific, so a source with no hooks is partial.
    share: ({ skin, source, native }) =>
      native ? 1 : !UX.LABELS[skin] ? 0 : hasMarkup(source) ? 1 : 0.5,
  },
  {
    key: 'refs',
    weight: 5,
    // `refMarker` reads the link, not the markup, so it works on every source.
    // Bitbucket identifies issues by key (PROJ-123), not a `#`/`!` number, so
    // only the pull/merge marker direction is emulated.
    share: ({ source, skin, native }) =>
      native ? 1 : source === 'gerrit' ? 0.3 : skin === 'bitbucket' ? 0.5 : 1,
  },
  {
    key: 'unmapped',
    weight: 5,
    share: ({ skin, source, native }) =>
      native ? 1 : UX.UNMAPPED[skin] ? (hasMarkup(source) ? 1 : 0.3) : 0,
  },
  {
    key: 'shortcuts',
    weight: 8,
    share: ({ source, skin, native }) => shortcutsShare(source, skin, native),
  },
];

/** Profile-page rubric. Weights sum to 100. */
const PROFILE = [
  {
    key: 'palette',
    weight: 12,
    share: ({ source, native }) => (native ? 1 : hasPalette(source) ? 1 : 0.2),
  },
  {
    key: 'orientation',
    weight: 16,
    // The profile passes are wired for GitHub's, GitLab's and (partly) Gitea's
    // markup; a Bitbucket source has no profile hooks.
    share: ({ source, skin, native }) =>
      native
        ? 1
        : !hasMarkup(source)
          ? 0.2
          : source === 'gitea'
            ? 0.4
            : skin === 'bitbucket'
              ? 0.6
              : 1,
  },
  {
    key: 'menu',
    weight: 20,
    // Rebuilt only where the source's markup exposes a container
    // (`SELECTORS[source].profileMenu`) *and* the skin has a build for it.
    // Bitbucket has no such hook, so the menu is not rebuilt.
    share: ({ source, skin, native }) => {
      if (native) return 1;
      if (!UX.SELECTORS[source]?.profileMenu) return 0.1;
      return UX.PROFILE_MENU[skin] ? 1 : 0;
    },
  },
  {
    key: 'reshape',
    weight: 12,
    // `paintProfileRail` runs on the GitLab skin, `paintProfileStats` on the
    // GitHub skin; neither runs for a source with no profile hooks.
    share: ({ source, skin, native }) => {
      if (native) return 1;
      if (source === 'gitea' || !hasMarkup(source)) return 0.1;
      if (skin === 'bitbucket') return 0.3;
      return 1;
    },
  },
  {
    key: 'landing',
    weight: 5,
    // GitHub's pinned cards become GitLab's "Personal projects" but stay a
    // pinned selection; GitLab has no pinned data for GitHub's section.
    share: ({ source, skin, native }) => {
      if (native) return 1;
      if (source === 'gitea' || !hasMarkup(source) || skin === 'bitbucket')
        return 0.2;
      return skin === 'gitlab' ? 0.8 : 0.5;
    },
  },
  {
    key: 'chrome',
    weight: 8,
    share: ({ skin, source, native }) => {
      if (native) return 1;
      if (!UX.CHROME[skin]) return 0;
      return hasMarkup(source) ? (skin === 'bitbucket' ? 0.8 : 1) : 0.5;
    },
  },
  {
    key: 'copy',
    weight: 8,
    share: ({ skin, source, native }) => {
      if (native) return 1;
      if (!Object.keys(UX.PHRASES[skin] || {}).length) return 0;
      return hasMarkup(source) ? (skin === 'bitbucket' ? 0.8 : 1) : 0.5;
    },
  },
  {
    key: 'unmapped',
    weight: 6,
    share: ({ skin, source, native }) => {
      if (native) return 1;
      if (!UX.UNMAPPED[skin]) return 0;
      return hasMarkup(source) ? (skin === 'bitbucket' ? 0.9 : 1) : 0.3;
    },
  },
  {
    key: 'refs',
    weight: 5,
    share: ({ source, skin, native }) =>
      native ? 1 : source === 'gerrit' ? 0.3 : skin === 'bitbucket' ? 0.5 : 1,
  },
  {
    key: 'shortcuts',
    weight: 8,
    share: ({ source, skin, native }) => shortcutsShare(source, skin, native),
  },
];

export const RUBRICS = { project: PROJECT, profile: PROFILE };

/** The weight total a rubric is expected to add up to. */
export const RUBRIC_TOTAL = 100;

/** The context a share function reads. */
function context(source, skin) {
  const layout = SITES.skins[skin]?.layout;
  // `native` is the source wearing its own UI. Nothing needs transforming, so
  // every dimension reports itself satisfied — but it is still *evaluated*, not
  // special-cased before the rubric runs.
  return { source, skin, layout, native: source === skin };
}

/** Every real source × skin pair: a source wearing its own UI is Off. */
export function isReal(source, skin) {
  return source !== skin;
}

/**
 * The parity score for one pair under one page type, out of 10 to one decimal.
 * A source wearing its own UI is evaluated like any other pair: each dimension
 * reports itself satisfied, so the rubric adds to 100 rather than the diagonal
 * being special-cased.
 */
export function score(source, skin, pageType = 'project') {
  const rubric = RUBRICS[pageType];
  if (!rubric) throw new Error(`unknown page type: ${pageType}`);
  const ctx = context(source, skin);
  const total = rubric.reduce(
    (sum, dim) => sum + dim.weight * dim.share(ctx),
    0,
  );
  // total is out of 100; /10 puts the score on a 0–10 scale, and rounding the
  // total to an integer rounds the score to one decimal.
  return Math.round(total) / 10;
}

/** The per-dimension contribution to a score, for auditing it. */
export function breakdown(source, skin, pageType = 'project') {
  const rubric = RUBRICS[pageType];
  const ctx = context(source, skin);
  return rubric.map((dim) => ({
    key: dim.key,
    weight: dim.weight,
    share: dim.share(ctx),
    points: dim.weight * dim.share(ctx),
  }));
}

/** The score table for a page type: rows of `{ source, scores: [per skin] }`. */
export function table(pageType = 'project') {
  return SOURCES.map((source) => ({
    source: source.key,
    label: source.label,
    scores: SKINS.map((skin) => score(source.key, skin.key, pageType)),
  }));
}

/** A score as it is written in the docs. */
export function cell(value) {
  return value === null ? '—' : value.toFixed(1);
}

/** The scorecard table for a page type, as it appears in docs/UX-PARITY.md. */
export function markdownTable(pageType = 'project') {
  const header = `| Source ↓ / Skin → | ${SKINS.map((s) => s.label).join(' | ')} |`;
  const rule = `| --- | ${SKINS.map(() => ':--:').join(' | ')} |`;
  const rows = table(pageType).map(
    (row) => `| **${row.label}** | ${row.scores.map(cell).join(' | ')} |`,
  );
  return [header, rule, ...rows];
}

// Replace the table under a `### …` heading with the generated one, so both
// page types' matrices are produced from this one definition.
function replaceTable(doc, heading, pageType) {
  const start = doc.indexOf(heading);
  if (start === -1) throw new Error(`docs heading not found: ${heading}`);
  const rest = doc.slice(start + heading.length);
  const end = rest.search(/\n#{2,4} /);
  const block = end === -1 ? rest : rest.slice(0, end);
  const tail = end === -1 ? '' : rest.slice(end);
  const lines = block.split('\n');
  const first = lines.findIndex((line) => line.startsWith('|'));
  if (first === -1) throw new Error(`no table under: ${heading}`);
  let last = first;
  while (last < lines.length && lines[last].startsWith('|')) last += 1;
  const rebuilt = [
    ...lines.slice(0, first),
    ...markdownTable(pageType),
    ...lines.slice(last),
  ].join('\n');
  return doc.slice(0, start + heading.length) + rebuilt + tail;
}

/** Regenerate the two scorecard tables in docs/UX-PARITY.md. */
export function writeDocs() {
  const url = new URL('../../docs/UX-PARITY.md', import.meta.url);
  let doc = readFileSync(url, 'utf8');
  doc = replaceTable(doc, '### Project pages, sources × skins', 'project');
  doc = replaceTable(doc, '### Profile pages, sources × skins', 'profile');
  writeFileSync(url, doc);
  return url.pathname;
}

/* ------------------------------------------------------------------- cli -- */

function main(args) {
  if (args.has('--write')) {
    console.log(`updated ${writeDocs()}`);
    return;
  }
  if (args.has('--json')) {
    console.log(
      JSON.stringify(
        { project: table('project'), profile: table('profile') },
        null,
        2,
      ),
    );
    return;
  }
  if (args.has('--detail')) {
    for (const pageType of ['project', 'profile']) {
      for (const { key: source } of SOURCES) {
        for (const { key: skin } of SKINS) {
          if (!isReal(source, skin)) continue;
          const parts = breakdown(source, skin, pageType)
            .map((d) => `${d.key} ${d.points}/${d.weight}`)
            .join(', ');
          console.log(
            `${pageType} ${source}→${skin}: ${score(source, skin, pageType)}  [${parts}]`,
          );
        }
      }
      console.log('');
    }
  }
  const header = `| Source ↓ / Skin → | ${SKINS.map((s) => s.label).join(' | ')} |`;
  const rule = `| --- | ${SKINS.map(() => ':--:').join(' | ')} |`;
  for (const pageType of ['project', 'profile']) {
    console.log(`\n${pageType === 'project' ? 'Project' : 'Profile'} pages\n`);
    console.log(header);
    console.log(rule);
    for (const row of table(pageType)) {
      console.log(`| **${row.label}** | ${row.scores.map(cell).join(' | ')} |`);
    }
  }
}

// Only when run as a program — importing the module (the test does) must not
// print anything.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(new Set(process.argv.slice(2)));
}
