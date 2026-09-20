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
  LABELS,
  LABEL_SCOPE,
  NAV_RULES,
  SHORTCUTS,
  translate,
  translateLabel,
  translateControl,
  refMarker,
  labelMatches,
  orderIndexes,
  orderItems,
  otherHostUrl,
} = UX;

describe('module shape', () => {
  test('publishes the shared surface', () => {
    for (const fn of [
      translate,
      translateLabel,
      translateControl,
      refMarker,
      labelMatches,
      orderIndexes,
      orderItems,
      otherHostUrl,
    ]) {
      assert.equal(typeof fn, 'function');
    }
    for (const table of [PHRASES, NAV, LABELS, SHORTCUTS]) {
      assert.equal(typeof table, 'object');
    }
    assert.equal(typeof LABEL_SCOPE, 'string');
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

describe('LABELS', () => {
  test('round-trip exactly between the two directions', () => {
    for (const [from, to] of Object.entries(LABELS.gitlab)) {
      assert.equal(LABELS.github[to], from, `github["${to}"] should be "${from}"`);
    }
    for (const [from, to] of Object.entries(LABELS.github)) {
      assert.equal(LABELS.gitlab[to], from, `gitlab["${to}"] should be "${from}"`);
    }
  });

  test('translateControl maps a whole control label', () => {
    assert.equal(translateControl('Merge', 'github'), 'Merge pull request');
    assert.equal(translateControl('Merge pull request', 'gitlab'), 'Merge');
    assert.equal(translateControl('Squash commits', 'github'), 'Squash and merge');
    assert.equal(translateControl('Rebase and merge', 'gitlab'), 'Rebase');
    assert.equal(translateControl('Security and quality', 'gitlab'), 'Security');
  });

  test('translateControl falls back to the phrase table', () => {
    assert.equal(translateControl('Pull requests', 'gitlab'), 'Merge requests');
    assert.equal(translateControl('Discussions', 'gitlab'), 'Discussions');
  });

  test('the merge and security words are never rewritten in prose', () => {
    // These moved out of PHRASES into LABELS precisely so that ordinary text
    // is left alone; only an exact control label is touched.
    assert.equal(translate('Squash and merge', 'gitlab'), 'Squash and merge');
    assert.equal(translate('Rebase', 'github'), 'Rebase');
    assert.equal(translate('Security and quality', 'gitlab'), 'Security and quality');
    assert.equal(translate('Merge', 'github'), 'Merge');
  });
});

describe('table symmetry', () => {
  test('PHRASES have the same size in both directions', () => {
    assert.equal(
      Object.keys(PHRASES.gitlab).length,
      Object.keys(PHRASES.github).length,
    );
  });

  test('every GitHub phrase key is produced by a GitLab phrase', () => {
    const gitlabValues = new Set(Object.values(PHRASES.gitlab));
    for (const key of Object.keys(PHRASES.github)) {
      assert.ok(gitlabValues.has(key), `no GitLab phrase produces "${key}"`);
    }
  });

  test('no table maps a label to itself', () => {
    for (const theme of ['gitlab', 'github']) {
      for (const table of [PHRASES[theme], LABELS[theme]]) {
        for (const [from, to] of Object.entries(table)) {
          assert.notEqual(from, to, `${theme}: ${from} -> ${to}`);
        }
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

  test('click targets only exist for mapped combos, and name a label', () => {
    const targets = UX.SHORTCUT_TARGETS;
    for (const theme of ['gitlab', 'github']) {
      for (const [combo, label] of Object.entries(targets[theme])) {
        assert.ok(SHORTCUTS[theme][combo], `${theme}: ${combo} is not a mapped combo`);
        assert.equal(typeof label, 'string');
        assert.ok(label.length > 0);
      }
    }
  });
});

describe('NAV_RULES', () => {
  test('the GitLab group rule resolves its container by scope + contains', () => {
    const rule = NAV_RULES.github[0];
    assert.equal(rule.scope, '.super-sidebar');
    assert.equal(rule.contains, 'Code');
    assert.ok(Array.isArray(rule.order) && rule.order.length >= 2);
    assert.equal(rule.item, 'li');
  });

  test('the GitHub rule targets the flat repo tab list', () => {
    const rule = NAV_RULES.gitlab[0];
    assert.match(rule.container, /UnderlineNav-body/);
    assert.ok(Array.isArray(rule.order) && rule.order.length >= 2);
  });
});

describe('otherHostUrl', () => {
  test('maps a GitHub repo and its PR / issue / file routes', () => {
    assert.equal(
      otherHostUrl('https://github.com/git/git'),
      'https://gitlab.com/git/git',
    );
    assert.equal(
      otherHostUrl('https://github.com/git/git/pull/1875'),
      'https://gitlab.com/git/git/-/merge_requests/1875',
    );
    assert.equal(
      otherHostUrl('https://github.com/git/git/issues/12'),
      'https://gitlab.com/git/git/-/issues/12',
    );
    assert.equal(
      otherHostUrl('https://github.com/git/git/tree/main/Documentation'),
      'https://gitlab.com/git/git/-/tree/main/Documentation',
    );
    assert.equal(
      otherHostUrl('https://github.com/git/git/blob/main/README.md'),
      'https://gitlab.com/git/git/-/blob/main/README.md',
    );
  });

  test('maps a GitLab project and its MR / issue / file routes', () => {
    assert.equal(
      otherHostUrl('https://gitlab.com/gitlab-org/gitlab'),
      'https://github.com/gitlab-org/gitlab',
    );
    assert.equal(
      otherHostUrl('https://gitlab.com/gitlab-org/gitlab/-/merge_requests/7'),
      'https://github.com/gitlab-org/gitlab/pull/7',
    );
    assert.equal(
      otherHostUrl('https://gitlab.com/gitlab-org/gitlab/-/issues/7'),
      'https://github.com/gitlab-org/gitlab/issues/7',
    );
    assert.equal(
      otherHostUrl('https://gitlab.com/gitlab-org/gitlab/-/tree/master/app'),
      'https://github.com/gitlab-org/gitlab/tree/master/app',
    );
  });

  test('keeps the query string and fragment', () => {
    assert.equal(
      otherHostUrl('https://github.com/git/git/pull/1?x=2#discussion'),
      'https://gitlab.com/git/git/-/merge_requests/1?x=2#discussion',
    );
  });

  test('refuses a host with no known pair', () => {
    assert.equal(otherHostUrl('https://github.acme.com/o/r'), null);
    assert.equal(otherHostUrl('https://example.com/o/r'), null);
    assert.equal(otherHostUrl('not a url'), null);
  });

  test('refuses paths that are not a repository', () => {
    assert.equal(otherHostUrl('https://github.com/settings'), null);
    assert.equal(otherHostUrl('https://github.com/orgs/foo'), null);
    assert.equal(otherHostUrl('https://gitlab.com/dashboard/merge_requests'), null);
    assert.equal(otherHostUrl('https://github.com'), null);
  });

  test('refuses a GitLab subgroup, which has no owner/repo form', () => {
    assert.equal(
      otherHostUrl('https://gitlab.com/a/b/c/-/merge_requests/1'),
      null,
    );
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

describe('labelMatches', () => {
  test('matches a whole label', () => {
    assert.equal(labelMatches('Pull requests', 'Pull requests'), true);
    assert.equal(labelMatches('  Merge  ', 'Merge'), true);
  });

  test('matches a label carrying a counter, whitespace and all', () => {
    assert.equal(labelMatches('Pull requests 387', 'Pull requests'), true);
    assert.equal(labelMatches('Pull requests\n-', 'Pull requests'), true);
  });

  test('does not match a longer word', () => {
    assert.equal(labelMatches('Pull requestsfoo', 'Pull requests'), false);
    assert.equal(labelMatches('Mergeable', 'Merge'), false);
  });

  test('rejects empty and unrelated text', () => {
    assert.equal(labelMatches('', 'Merge'), false);
    assert.equal(labelMatches(null, 'Merge'), false);
    assert.equal(labelMatches('Issues', 'Merge'), false);
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
