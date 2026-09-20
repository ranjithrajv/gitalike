/**
 * Unit tests for src/lib/ux.js — the copy, reference, ordering and shortcut
 * tables that the UX content script applies.
 *
 * Like sites.test.mjs, the module is a classic script that publishes itself on
 * `globalThis.GIT_SAME_UX`; importing it is all that is needed.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import '../src/lib/ux.js';

const UX = globalThis.GIT_SAME_UX;
const {
  PHRASES,
  NAV,
  SHORTCUTS,
  translate,
  translateLabel,
  refMarker,
  orderIndexes,
  orderItems,
} = UX;

describe('module shape', () => {
  test('publishes the shared surface', () => {
    for (const fn of [translate, translateLabel, refMarker, orderIndexes, orderItems]) {
      assert.equal(typeof fn, 'function');
    }
    for (const table of [PHRASES, NAV, SHORTCUTS]) {
      assert.equal(typeof table, 'object');
    }
  });

  test('directly maps a phrase to the target product', () => {
    assert.equal(translate('Pull requests', 'gitlab'), 'Merge requests');
    assert.equal(translate('Merge requests', 'github'), 'Pull requests');
    assert.equal(translate('Insights', 'gitlab'), 'Analytics');
    assert.equal(translate('Analytics', 'github'), 'Insights');
  });

  test('never rewrites part of a word', () => {
    // "Gist" must not fire inside "Gists" or "Gistify".
    assert.equal(translate('Gistify', 'gitlab'), 'Gistify');
    assert.equal(translate('A Gist', 'gitlab'), 'A Snippet');
    assert.equal(translate('Gists', 'gitlab'), 'Snippets');
  });

  test('longest phrase wins', () => {
    // "Pull request" must not clobber "Pull requests" first.
    assert.equal(translate('Pull requests and a Pull request', 'gitlab'),
      'Merge requests and a Merge request');
  });

  test('leaves untouched copy untouched', () => {
    assert.equal(translate('A normal sentence.', 'gitlab'), 'A normal sentence.');
    assert.equal(translate('', 'gitlab'), '');
  });

  test('a theme only ever applies its own direction', () => {
    // GitHub's word under the GitHub theme is unchanged.
    assert.equal(translate('Pull request', 'github'), 'Pull request');
    assert.equal(translate('Merge request', 'gitlab'), 'Merge request');
  });
});

describe('translateLabel', () => {
  test('translates exact navigation words', () => {
    assert.equal(translateLabel('Code', 'gitlab'), 'Repository');
    assert.equal(translateLabel('Actions', 'gitlab'), 'CI/CD');
    assert.equal(translateLabel('Repository', 'github'), 'Code');
  });

  test('falls back to the phrase table for longer labels', () => {
    assert.equal(translateLabel('Pull requests', 'gitlab'), 'Merge requests');
  });

  test('does not touch an unknown label', () => {
    assert.equal(translateLabel('Discussions', 'gitlab'), 'Discussions');
  });
});

describe('NAV tables', () => {
  test('are scoped per direction and never no-ops', () => {
    for (const theme of ['gitlab', 'github']) {
      for (const [from, to] of Object.entries(NAV[theme])) {
        assert.notEqual(from, to, `${theme}: ${from} -> ${to}`);
      }
    }
  });
});

describe('SHORTCUTS', () => {
  test('only translate genuinely different combos', () => {
    for (const theme of ['gitlab', 'github']) {
      for (const [from, to] of Object.entries(SHORTCUTS[theme])) {
        assert.match(from, /^g[a-z]$/);
        assert.match(to, /^g[a-z]$/);
        assert.notEqual(from, to, `${theme}: ${from} -> ${to}`);
      }
    }
  });

  test('the two directions are inverses where they overlap', () => {
    // GitHub "pull requests" (g p) <-> GitLab "merge requests" (g m).
    assert.equal(SHORTCUTS.github.gp, 'gm');
    assert.equal(SHORTCUTS.gitlab.gm, 'gp');
  });
});

describe('refMarker', () => {
  test('a GitHub pull URL becomes a GitLab ! marker', () => {
    assert.equal(
      refMarker('https://github.com/o/r/pull/42', 'gitlab'),
      '!42',
    );
  });

  test('a GitLab merge-request URL becomes a GitHub # marker', () => {
    assert.equal(
      refMarker('https://gitlab.com/g/p/-/merge_requests/7', 'github'),
      '#7',
    );
  });

  test('trailing path, query and fragment still match', () => {
    assert.equal(refMarker('/o/r/pull/5/files', 'gitlab'), '!5');
    assert.equal(refMarker('/o/r/merge_requests/9#note', 'github'), '#9');
  });

  test('issues and unrelated links are left alone', () => {
    assert.equal(refMarker('/o/r/issues/3', 'gitlab'), null);
    assert.equal(refMarker('/o/r/blob/main/a.js', 'gitlab'), null);
    assert.equal(refMarker('', 'gitlab'), null);
    assert.equal(refMarker(null, 'gitlab'), null);
  });
});

describe('orderItems', () => {
  const order = ['Code', 'Issues', 'Merge requests', 'Actions'];

  test('sorts known labels into the requested order', () => {
    assert.deepEqual(
      orderItems(['Actions', 'Code', 'Issues'], order),
      ['Code', 'Issues', 'Actions'],
    );
  });

  test('ranks a label carrying a counter by its prefix', () => {
    assert.deepEqual(
      orderItems(['Merge requests 12', 'Code', 'Actions'], order),
      ['Code', 'Merge requests 12', 'Actions'],
    );
  });

  test('unknown labels keep their relative order at the end', () => {
    assert.deepEqual(
      orderItems(['Zed', 'Actions', 'Alpha'], order),
      ['Actions', 'Zed', 'Alpha'],
    );
  });

  test('an already-ordered list is returned unchanged', () => {
    assert.deepEqual(
      orderItems(['Code', 'Issues', 'Actions'], order),
      ['Code', 'Issues', 'Actions'],
    );
  });

  test('orderIndexes hands back the permutation, not the labels', () => {
    assert.deepEqual(orderIndexes(['Actions', 'Code', 'Issues'], order), [1, 2, 0]);
  });

  test('orderIndexes is stable for equal ranks', () => {
    assert.deepEqual(orderIndexes(['Zed', 'Actions', 'Alpha'], order), [1, 0, 2]);
  });
});
