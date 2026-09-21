/**
 * The skin and source contracts.
 *
 * GitAlike has two independent axes a contributor can extend:
 *
 *   - a *source* is a forge's markup (github, gitlab, gitea): the DOM a page is
 *     built on. Its home is `SELECTORS`, the canary pages, and the source-keyed
 *     scopes in ux.js.
 *   - a *skin* is a target UI (github, gitlab, bitbucket): the product a page is
 *     made to look like. Its home is the vocabulary and order tables in ux.js,
 *     the `skins` entry in sites.js, and one stylesheet.
 *
 * This file is the single definition of "complete" for both. A half-added skin
 * or source fails here with the missing pieces named, instead of with a dozen
 * unrelated failures spread across the other suites.
 *
 * It is deliberately mechanical: it checks that the parts exist and are wired,
 * not that the wording or palette is any good. The reviewed fixtures
 * (`tests/fixtures/target-chrome.json`) and the parity gates are what judge
 * quality.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import '../src/lib/skins.js';
import '../src/lib/sites.js';
import '../src/lib/sources.js';
import '../src/lib/ux.js';

const SITES = globalThis.GITALIKE;
const UX = globalThis.GITALIKE_UX;

const file = (rel) =>
  readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const hasFile = (rel) => existsSync(new URL(`../${rel}`, import.meta.url));

const THEMES = SITES.THEMES;
const SOURCES = Object.keys(UX.SELECTORS);

/**
 * Tables every skin must key. These are read on every page while the skin is
 * active, so a missing entry is not a rough edge — the pass throws or silently
 * does nothing. Optional tables (`SHORTCUTS`, `TOPBAR_HIDE`, `NAV_GROUPS`,
 * `NAV_KEEP`/`NAV_HIDE`, `PROJECT_TABS`) are per-skin capabilities and are not
 * required; the runtime already falls back when they are absent.
 */
const REQUIRED_SKIN_TABLES = [
  'PHRASES', // copy translation
  'NAV', // navigation labels
  'LABELS', // whole-control labels
  'CHROME', // account/menu chrome
  'UNMAPPED', // features the product has no page for
  'NAV_RULES', // how each source's navigation is reordered
  'PROFILE_MENU', // the profile menu, rebuilt in the product's words
];

describe('skin contract', () => {
  for (const skin of THEMES) {
    test(`skin '${skin}' supplies every required part`, () => {
      const missing = [];

      const meta = SITES.skins[skin];
      if (!meta) {
        missing.push('a `skins` entry in src/lib/sites.js');
      } else {
        if (!meta.product)
          missing.push('skins[skin].product — the product name');
        if (!meta.badge) missing.push('skins[skin].badge — the toolbar badge');
        if (!/^#[0-9a-f]{6}$/i.test(meta.color ?? ''))
          missing.push('skins[skin].color — a #rrggbb value');
        if (!['github', 'gitlab'].includes(meta.layout))
          missing.push("skins[skin].layout — 'github' or 'gitlab'");
      }

      for (const table of REQUIRED_SKIN_TABLES) {
        if (!UX[table] || !Object.hasOwn(UX[table], skin)) {
          missing.push(`ux.js ${table}[${skin}]`);
        }
      }

      const css = `src/themes/as-${skin}.css`;
      if (!hasFile(css)) {
        missing.push(`${css} — the palette and structure`);
      } else if (!file(css).includes(`gs-theme-${skin}`)) {
        missing.push(`${css} must scope its rules to html.gs-theme-${skin}`);
      }
      if (!file('src/background.js').includes(`themes/as-${skin}.css`)) {
        missing.push(
          `src/background.js CONTENT_CSS must register themes/as-${skin}.css`,
        );
      }

      assert.deepEqual(
        missing,
        [],
        `skin '${skin}' is incomplete — add:\n  - ${missing.join('\n  - ')}`,
      );
    });
  }

  test('the "no counterpart" marker is not tied to a fixed skin list', () => {
    // It styles any active skin, so a new skin inherits it rather than needing
    // this file edited. (Bitbucket had once been left out of the hard-coded pair.)
    assert.match(
      file('src/themes/ux-markers.css'),
      /\[class\*=["']gs-theme-["']\]/,
      'ux-markers.css should target any gs-theme-* class',
    );
  });
});

describe('source contract', () => {
  for (const source of SOURCES) {
    test(`source '${source}' supplies every required part`, () => {
      const missing = [];

      const hooks = UX.SELECTORS[source];
      if (!hooks || Object.keys(hooks).length === 0) {
        missing.push(`SELECTORS[${source}] with at least one DOM hook`);
      }

      const pages = UX.CANARY_PAGES.filter((page) => page.source === source);
      if (pages.length === 0) {
        missing.push(`a CANARY_PAGES entry with source: '${source}'`);
      }
      for (const page of pages) {
        if (!page.keys?.length) {
          missing.push(
            `CANARY_PAGES '${page.name}' must list the keys it pins`,
          );
        }
      }

      assert.deepEqual(
        missing,
        [],
        `source '${source}' is incomplete — add:\n  - ${missing.join('\n  - ')}`,
      );
    });
  }

  test('every nav rule names a known markup source', () => {
    // A rule whose `source` is not in SELECTORS could never be selected.
    const known = new Set(SOURCES);
    for (const [skin, rules] of Object.entries(UX.NAV_RULES)) {
      for (const rule of rules ?? []) {
        assert.ok(
          known.has(rule.source),
          `${skin}: NAV_RULES names source '${rule.source}', which is not in SELECTORS`,
        );
      }
    }
  });
});
