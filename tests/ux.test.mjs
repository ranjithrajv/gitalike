/**
 * Unit tests for src/lib/ux.js — the copy, reference, ordering and shortcut
 * tables that the UX content script applies.
 *
 * Like sites.test.mjs, the module is a classic script that publishes itself on
 * `globalThis.GITALIKE_UX`; importing it is all that is needed.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/lib/ux.js';

const UX = globalThis.GITALIKE_UX;
const {
  PHRASES,
  NAV,
  NAV_GROUPS,
  NAV_HIDE,
  NAV_KEEP,
  NAV_SCOPE,
  LABELS,
  CHROME,
  UNMAPPED,
  LABEL_SCOPE,
  NAV_RULES,
  SELECTORS,
  CANARY_PAGES,
  SHORTCUTS,
  translate,
  translateControl,
  controlLabel,
  noEquivalentFor,
  refMarker,
  labelMatches,
  navGroupFor,
  navHidden,
  navKeep,
  orderIndexes,
  activeTabFor,
  sectionLabelText,
  METADATA_HIDE,
  projectTabs,
  PROFILE_MENU,
  repoNav,
  otherHostUrl,
  hostProduct,
} = UX;

describe('module shape', () => {
  test('publishes the shared surface', () => {
    for (const fn of [
      translate,
      translateControl,
      noEquivalentFor,
      refMarker,
      labelMatches,
      navGroupFor,
      navHidden,
      navKeep,
      orderIndexes,
      activeTabFor,
      sectionLabelText,
      projectTabs,
      repoNav,
      otherHostUrl,
      hostProduct,
    ]) {
      assert.equal(typeof fn, 'function');
    }
    for (const table of [PHRASES, NAV, NAV_GROUPS, NAV_HIDE, NAV_KEEP, LABELS, CHROME, UNMAPPED, SHORTCUTS, SELECTORS, PROFILE_MENU]) {
      assert.equal(typeof table, 'object');
    }
    assert.equal(typeof LABEL_SCOPE, 'string');
    assert.ok(Array.isArray(METADATA_HIDE));
    assert.ok(Array.isArray(CANARY_PAGES));
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

  test('sentence case is translated too', () => {
    // GitHub labels are often sentence case ("New pull request").
    assert.equal(translate('New pull request', 'gitlab'), 'New merge request');
    assert.equal(translate('New merge request', 'github'), 'New pull request');
  });

  test('leaves untouched copy untouched', () => {
    assert.equal(translate('A normal sentence.', 'gitlab'), 'A normal sentence.');
    assert.equal(translate('', 'gitlab'), '');
  });

  test('an unknown theme is left unchanged, not emptied', () => {
    // Guards the empty-table path: a single alternation with no keys would
    // otherwise match the empty string everywhere.
    assert.equal(translate('Pull requests', 'bitbucket'), 'Pull requests');
    assert.equal(translate('Merge requests', null), 'Merge requests');
  });

  test('a theme only ever applies its own direction', () => {
    // GitHub's word under the GitHub theme is unchanged.
    assert.equal(translate('Pull request', 'github'), 'Pull request');
    assert.equal(translate('Merge request', 'gitlab'), 'Merge request');
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

describe('CHROME', () => {
  test('round-trips between the two directions', () => {
    for (const [from, to] of Object.entries(CHROME.gitlab)) {
      assert.equal(CHROME.github[to], from, `github["${to}"] should be "${from}"`);
    }
    for (const [from, to] of Object.entries(CHROME.github)) {
      assert.equal(CHROME.gitlab[to], from, `gitlab["${to}"] should be "${from}"`);
    }
  });

  test('translateControl maps account/menu chrome', () => {
    assert.equal(translateControl('Your repositories', 'gitlab'), 'Your projects');
    assert.equal(translateControl('Your projects', 'github'), 'Your repositories');
    assert.equal(translateControl('Your gists', 'gitlab'), 'Your snippets');
    assert.equal(translateControl('Starred projects', 'github'), 'Your stars');
  });

  test('chrome wording is never rewritten in prose', () => {
    assert.equal(translate('Your repositories', 'gitlab'), 'Your repositories');
    assert.equal(translate('Your projects', 'github'), 'Your projects');
  });
});

describe('controlLabel', () => {
  test('returns the exact whole-label replacement, or null', () => {
    assert.equal(controlLabel('Merge pull request', 'gitlab'), 'Merge');
    assert.equal(controlLabel('Your projects', 'github'), 'Your repositories');
    assert.equal(controlLabel('Pull requests', 'gitlab'), null);
    assert.equal(controlLabel('not a label', 'gitlab'), null);
  });

  test('an exact control label wins over phrase translation', () => {
    // "Merge pull request" contains the phrase "pull request": if phrase
    // translation runs first it becomes "Merge merge request" and the exact
    // entry is missed. The whole-label lookup has to run on the original.
    assert.equal(translate('Merge pull request', 'gitlab'), 'Merge merge request');
    assert.equal(
      controlLabel('Merge pull request', 'gitlab') ??
        translate('Merge pull request', 'gitlab'),
      'Merge',
    );
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

  test('the Gitea rule for the GitHub skin shares GitHub’s order', () => {
    const rule = NAV_RULES.github[1];
    assert.match(rule.container, /overflow-menu/);
    assert.equal(rule.item, 'a.item');
    assert.equal(rule.order, NAV_RULES.github[0].order);
  });

  test('the GitHub rule targets the flat repo tab list', () => {
    const rule = NAV_RULES.gitlab[0];
    assert.match(rule.container, /UnderlineNav-body/);
    assert.ok(Array.isArray(rule.order) && rule.order.length >= 2);
  });

  test('the Gitea/Forgejo rule targets the overflow-menu list', () => {
    const rule = NAV_RULES.gitlab[1];
    assert.match(rule.container, /overflow-menu/);
    assert.equal(rule.item, 'a.item');
    // Both sources take GitLab's order, so the list is shared rather than copied.
    assert.equal(rule.order, NAV_RULES.gitlab[0].order);
  });

  test('Gitea is a known nav scope, so its labels are rewritten too', () => {
    assert.ok(NAV_SCOPE.split(',').includes('overflow-menu'));
  });

  test('the repo order ranks the *displayed* labels', () => {
    const order = NAV_RULES.gitlab[0].order;
    // "Issues" is shown as "Work items"; ranking on the source label would drop
    // it to the end of the nav.
    assert.ok(order.includes('Work items'));
    assert.ok(!order.includes('Issues'));
    assert.deepEqual(
      orderIndexes(['CI/CD', 'Work items', 'Repository', 'Merge requests'], order),
      [1, 3, 2, 0],
    );
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

  test('maps the remaining routes and their list / detail forms', () => {
    assert.equal(
      otherHostUrl('https://github.com/o/r/wiki/Home'),
      'https://gitlab.com/o/r/-/wikis/Home',
    );
    assert.equal(
      otherHostUrl('https://github.com/o/r/actions'),
      'https://gitlab.com/o/r/-/pipelines',
    );
    assert.equal(
      otherHostUrl('https://github.com/o/r/commits/main'),
      'https://gitlab.com/o/r/-/commits/main',
    );
    assert.equal(
      otherHostUrl('https://github.com/o/r/releases/tag/v1'),
      'https://gitlab.com/o/r/-/releases/tag/v1',
    );
    // The route table is written once and inverted, so both directions agree.
    assert.equal(
      otherHostUrl('https://gitlab.com/o/r/-/wikis/Home'),
      'https://github.com/o/r/wiki/Home',
    );
    assert.equal(
      otherHostUrl('https://gitlab.com/o/r/-/pipelines'),
      'https://github.com/o/r/actions',
    );
    assert.equal(
      otherHostUrl('https://github.com/o/r/pulls'),
      'https://gitlab.com/o/r/-/merge_requests',
    );
    assert.equal(
      otherHostUrl('https://gitlab.com/o/r/-/merge_requests'),
      'https://github.com/o/r/pulls',
    );
  });

  test('an unknown route falls back to the repository root', () => {
    assert.equal(
      otherHostUrl('https://github.com/o/r/unknownroute/x'),
      'https://gitlab.com/o/r',
    );
    assert.equal(
      otherHostUrl('https://gitlab.com/o/r/-/unknownroute'),
      'https://github.com/o/r',
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

describe('hostProduct', () => {
  test('names the product a known forge URL belongs to', () => {
    assert.equal(hostProduct('https://github.com/o/r'), 'GitHub');
    assert.equal(hostProduct('https://gitlab.com/g/p/-/issues/1'), 'GitLab');
  });

  test('returns null for anything that is not one of the two forges', () => {
    assert.equal(hostProduct('https://github.acme.com/o/r'), null);
    assert.equal(hostProduct('https://example.com/o/r'), null);
    assert.equal(hostProduct('not a url'), null);
  });

  test('the other-host URL and its product agree', () => {
    const other = otherHostUrl('https://github.com/git/git');
    assert.equal(hostProduct(other), 'GitLab');
  });
});

describe('UNMAPPED', () => {
  test('names the product that lacks the feature', () => {
    assert.equal(noEquivalentFor('Discussions', 'gitlab'), 'GitLab');
    assert.equal(noEquivalentFor('Sponsors', 'gitlab'), 'GitLab');
    assert.equal(noEquivalentFor('Epics', 'github'), 'GitHub');
    assert.equal(noEquivalentFor('Merge trains', 'github'), 'GitHub');
  });

  test('a feature with a counterpart is not marked', () => {
    assert.equal(noEquivalentFor('Pull requests', 'gitlab'), null);
    assert.equal(noEquivalentFor('Merge requests', 'github'), null);
    assert.equal(noEquivalentFor('Wiki', 'github'), null);
  });

  test('only applies in its own direction', () => {
    assert.equal(noEquivalentFor('Epics', 'gitlab'), null);
    assert.equal(noEquivalentFor('Discussions', 'github'), null);
  });

  test('never marks something it also translates', () => {
    const targets = { gitlab: 'GitLab', github: 'GitHub' };
    for (const theme of ['gitlab', 'github']) {
      const mapped = new Set([
        ...Object.keys(PHRASES[theme]),
        ...Object.keys(NAV[theme]),
        ...Object.keys(LABELS[theme]),
      ]);
      for (const [label, product] of Object.entries(UNMAPPED[theme])) {
        assert.equal(product, targets[theme], `${theme}: ${label}`);
        assert.ok(!mapped.has(label), `${theme}: ${label} is both mapped and marked`);
      }
    }
  });
});

describe('NAV_GROUPS', () => {
  test('gathers repo tabs under GitLab group headings', () => {
    assert.equal(navGroupFor('Merge requests', 'gitlab'), 'Code');
    assert.equal(navGroupFor('Repository', 'gitlab'), 'Code');
    // The displayed label is "Work items" (NAV renames Issues), so the group
    // table is keyed by that, not by the source label.
    assert.equal(navGroupFor('Work items', 'gitlab'), 'Plan');
    assert.equal(navGroupFor('Issues', 'gitlab'), null);
    assert.equal(navGroupFor('Issue boards', 'gitlab'), 'Plan');
    assert.equal(navGroupFor('CI/CD', 'gitlab'), 'Build');
    assert.equal(navGroupFor('Analytics', 'gitlab'), 'Analyze');
  });

  test('a label carrying a counter still matches', () => {
    assert.equal(navGroupFor('Merge requests 387', 'gitlab'), 'Code');
  });

  test('items with no group, and the other theme, return null', () => {
    assert.equal(navGroupFor('Discussions', 'gitlab'), null);
    assert.equal(navGroupFor('Merge requests', 'github'), null);
  });

  test('every group heading is a non-empty string', () => {
    for (const group of Object.values(NAV_GROUPS.gitlab)) {
      assert.equal(typeof group, 'string');
      assert.ok(group.length > 0);
    }
  });
});

describe('NAV_HIDE', () => {
  test('hides the items the applied product has no page for', () => {
    assert.equal(navHidden('Feature catalog', 'github'), true);
    assert.equal(navHidden('Iterations', 'github'), true);
    assert.equal(navHidden('Discussions', 'gitlab'), true);
    assert.equal(navHidden('Sponsors', 'gitlab'), true);
  });

  test('keeps items the applied product does have', () => {
    assert.equal(navHidden('Repository', 'github'), false);
    assert.equal(navHidden('Pull requests', 'github'), false);
    assert.equal(navHidden('Feature catalog', 'gitlab'), false);
  });

  test('a label carrying a counter still matches', () => {
    assert.equal(navHidden('Iterations 3', 'github'), true);
  });
});

describe('NAV_KEEP', () => {
  test('keeps only GitHub’s project-page options under the GitHub skin', () => {
    for (const keep of ['Code', 'Issues', 'Pull requests', 'Actions', 'Projects', 'Wiki', 'Security', 'Insights', 'Settings']) {
      assert.equal(navKeep(keep, 'github'), true, keep);
    }
  });

  test('drops the items GitHub’s project page does not show', () => {
    for (const drop of ['Branches', 'Commits', 'Tags', 'Labels', 'Milestones', 'Members', 'Help', 'GitLab']) {
      assert.equal(navKeep(drop, 'github'), false, drop);
    }
  });

  test('the other theme has no whitelist', () => {
    assert.equal(navKeep('Branches', 'gitlab'), true);
  });

  // Gitea renders the count with no separator ("Issues1.5k"), GitHub with a
  // space and a suffix ("Issues 5k+"), GitLab with a space or a bare "-". All
  // three are the same tab and all three have to survive the whitelist.
  test('keeps a tab however its forge spells the counter', () => {
    for (const label of [
      'Issues1.5k',
      'Pull requests150',
      'Actions14',
      'Issues 5k+',
      'Pull requests 2.7k',
      'Security 54',
      'Issues 1,234',
      'Pull requests -',
    ]) {
      assert.equal(navKeep(label, 'github'), true, label);
    }
  });

  test('a counter is digits, not extra words', () => {
    assert.equal(navKeep('Actions analytics', 'github'), false);
    assert.equal(navKeep('Code review analytics', 'github'), false);
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

  test('a Gitea/Forgejo /pulls/N URL is matched too', () => {
    assert.equal(refMarker('https://codeberg.org/o/r/pulls/11', 'gitlab'), '!11');
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

  test('matches a counter with no separator before it', () => {
    assert.equal(labelMatches('Issues1.5k', 'Issues'), true);
    assert.equal(labelMatches('Pull requests150', 'Pull requests'), true);
  });

  // "Code review analytics" is its own destination, not the Code tab wearing a
  // counter — matching it as "Code" marked the wrong item active.
  test('does not match a label that carries extra words', () => {
    assert.equal(labelMatches('Code review analytics', 'Code'), false);
    assert.equal(labelMatches('Actions analytics', 'Actions'), false);
  });

  test('rejects empty and unrelated text', () => {
    assert.equal(labelMatches('', 'Merge'), false);
    assert.equal(labelMatches(null, 'Merge'), false);
    assert.equal(labelMatches('Issues', 'Merge'), false);
  });
});

describe('orderIndexes', () => {
  const order = ['Code', 'Issues', 'Merge requests', 'Actions'];

  test('hands back the permutation of known labels, not the labels', () => {
    assert.deepEqual(orderIndexes(['Actions', 'Code', 'Issues'], order), [1, 2, 0]);
  });

  test('ranks a label carrying a counter by its prefix', () => {
    assert.deepEqual(
      orderIndexes(['Merge requests 12', 'Code', 'Actions'], order),
      [1, 0, 2],
    );
  });

  test('unknown labels keep their relative order at the end', () => {
    assert.deepEqual(orderIndexes(['Zed', 'Actions', 'Alpha'], order), [1, 0, 2]);
  });

  test('an already-ordered list is its own permutation', () => {
    assert.deepEqual(orderIndexes(['Code', 'Issues', 'Actions'], order), [0, 1, 2]);
  });
});

describe('activeTabFor', () => {
  test('maps each GitLab project page to GitHub’s tab', () => {
    assert.equal(activeTabFor('projects:merge_requests:show'), 'Pull requests');
    assert.equal(activeTabFor('projects:tree:show'), 'Code');
    assert.equal(activeTabFor('projects:wikis:show'), 'Wiki');
    assert.equal(activeTabFor('projects:pipelines:index'), 'Actions');
  });

  test('leaves a page with no GitHub counterpart unmarked', () => {
    assert.equal(activeTabFor('users:show'), null);
    assert.equal(activeTabFor(''), null);
    assert.equal(activeTabFor(undefined), null);
  });

  test('does not mistake a longer page name for a prefix', () => {
    // "projects:issues" is not a GitLab page, and "projects:merge_requestsfoo"
    // must not rank as merge requests.
    assert.equal(activeTabFor('projects:issues'), null);
    assert.equal(activeTabFor('projects:merge_requestsfoo'), null);
  });
});

describe('sectionLabelText', () => {
  test('strips the counter GitHub embeds in a section heading', () => {
    assert.equal(sectionLabelText('Releases240 (240)'), 'Releases');
    assert.equal(sectionLabelText('Contributors2,572 (2,572)'), 'Contributors');
  });

  test('normalises whitespace and tolerates an empty heading', () => {
    assert.equal(sectionLabelText('  Used   by '), 'Used by');
    assert.equal(sectionLabelText(''), '');
    assert.equal(sectionLabelText(null), '');
  });
});

describe('projectTabs', () => {
  test('uses the links GitLab renders and synthesises the rest', () => {
    const tabs = projectTabs('/a/b', { issues: '/a/b/-/issues' });
    assert.deepEqual(tabs[0], ['Code', '/a/b']);
    assert.deepEqual(tabs[1], ['Issues', '/a/b/-/issues']);
    assert.deepEqual(tabs[2], ['Pull requests', '/a/b/-/merge_requests']);
    assert.deepEqual(tabs[5], ['Wiki', '/a/b/-/wikis/home']);
    assert.equal(tabs.length, 8);
  });

  test('keeps GitHub’s tab order', () => {
    assert.deepEqual(
      projectTabs('/a/b').map(([label]) => label),
      ['Code', 'Issues', 'Pull requests', 'Actions', 'Projects', 'Wiki', 'Security and quality', 'Insights'],
    );
  });
});

describe('PROFILE_MENU', () => {
  test('is GitHub’s profile tabs, in GitHub’s order', () => {
    const menu = PROFILE_MENU.github('octocat');
    assert.deepEqual(
      menu.map(([label]) => label),
      ['Overview', 'Repositories', 'Projects', 'Packages', 'Stars'],
    );
  });

  test('is GitLab’s destinations, named after the user', () => {
    const menu = PROFILE_MENU.gitlab('octocat', 'The Octocat');
    assert.equal(menu[0][0], 'The Octocat');
    assert.equal(menu[0][1], '/octocat');
    assert.deepEqual(
      menu.map(([label]) => label),
      ['The Octocat', 'Activity', 'Groups', 'Contributed projects', 'Personal projects', 'Starred projects', 'Snippets', 'Followers', 'Following'],
    );
  });
});

describe('repoNav', () => {
  const items = [
    { href: '/code', label: 'Code', active: true },
    { href: '/issues', label: 'Issues' },
    { href: '/pulls', label: 'Pull requests' },
    { href: '/projects', label: 'Projects' },
    { href: '/releases', label: 'Releases' },
    { href: '/packages', label: 'Packages' },
    { href: '/activity', label: 'Activity' },
    { href: '/actions', label: 'Actions' },
  ];
  const order = NAV_RULES.gitlab.find((r) => r.source === 'gitea').order;

  test('relabels, orders and groups Gitea’s repo tabs as GitLab’s sidebar', () => {
    const entries = repoNav(items, 'gitlab', order);
    assert.deepEqual(
      entries.map((e) => e.group ?? e.label),
      [
        'Plan',
        'Work items',
        'Issue boards',
        'Code',
        'Merge requests',
        'Repository',
        'Build',
        'CI/CD',
        'Deploy',
        'Releases',
        'Packages',
        'Activity',
      ],
    );
  });

  test('carries the source label and the active page through', () => {
    const entries = repoNav(items, 'gitlab', order);
    const repo = entries.find((e) => e.label === 'Repository');
    assert.equal(repo.raw, 'Code');
    assert.equal(repo.href, '/code');
    assert.equal(repo.active, true);
    assert.equal(entries.find((e) => e.label === 'Work items').active, false);
  });

  test('an item with no group is left ungrouped', () => {
    const entries = repoNav(items, 'gitlab', order);
    const activity = entries.findIndex((e) => e.label === 'Activity');
    assert.equal(typeof entries[activity - 1].label, 'string');
    assert.equal(entries.some((e) => e.group === 'Activity'), false);
  });
});

describe('SELECTORS / CANARY_PAGES', () => {
  test('every source names the repo-navigation hook the nav tables use', () => {
    for (const source of Object.keys(SELECTORS)) {
      assert.equal(typeof SELECTORS[source], 'object');
    }
    // The nav rules key their containers off the same strings, so the canary
    // and the reorder cannot drift.
    assert.ok(SELECTORS.github.repoNavList.includes('UnderlineNav-body'));
    assert.ok(SELECTORS.gitea.repoNavList.includes('overflow-menu'));
  });

  test('every canary page references a selector that exists', () => {
    for (const page of CANARY_PAGES) {
      assert.ok(SELECTORS[page.source], `${page.name} names a known source`);
      for (const key of page.keys) {
        assert.equal(
          typeof SELECTORS[page.source][key],
          'string',
          `${page.source}.${key} exists`,
        );
      }
    }
  });

  test('the nav rules and the selector table name the same containers', () => {
    // NAV_RULES spells its containers out before SELECTORS exists; this keeps
    // the two from drifting apart.
    const githubRule = NAV_RULES.gitlab.find((r) => r.container.includes('UnderlineNav'));
    assert.equal(githubRule.container, SELECTORS.github.repoNavList);
    for (const theme of ['gitlab', 'github']) {
      const giteaRule = NAV_RULES[theme].find((r) => r.container?.includes('overflow-menu'));
      assert.equal(giteaRule.container, SELECTORS.gitea.repoNavList);
    }
  });

  test('every nav rule names the markup source it belongs to', () => {
    // The source is how a caller picks the rule for a known forge without
    // matching an implementation detail such as its item selector.
    for (const rules of Object.values(NAV_RULES)) {
      for (const rule of rules) {
        assert.ok(
          ['github', 'gitlab', 'gitea'].includes(rule.source),
          `${rule.container || rule.scope} names a source`,
        );
      }
    }
  });

  test('every selector a stylesheet owns appears in a stylesheet', () => {
    // `SELECTORS` marks the entries a stylesheet owns with `// css`; CSS cannot
    // read the table, so this is the only thing that proves the two agree.
    const themes = [
      'as-gitlab.css',
      'as-github.css',
      'ux-markers.css',
      'ux-nav.css',
    ]
      .map((file) => readFileSync(new URL(`../src/themes/${file}`, import.meta.url), 'utf8'))
      .join('\n');
    // The classes, ids and attribute tests a selector names, so a compound
    // selector is checked token by token rather than as one exact string.
    const probes = (selector) =>
      selector.split(',').flatMap((part) => {
        const found = [];
        const bare = part.replace(/\[[^\]]*\]/g, (attr) => {
          found.push(attr.replace(/\s+/g, ' '));
          return ' ';
        });
        for (const m of bare.matchAll(/#([\w-]+)/g)) found.push(`#${m[1]}`);
        for (const m of bare.matchAll(/\.([\w-]+)/g)) found.push(`.${m[1]}`);
        return found;
      });
    const source = readFileSync(new URL('../src/lib/ux.js', import.meta.url), 'utf8');
    let checked = 0;
    for (const m of source.matchAll(/^\s*[A-Za-z0-9_]+:\s*'([^']+)',\s*\/\/ css\s*$/gm)) {
      checked += 1;
      for (const probe of probes(m[1])) {
        assert.ok(themes.includes(probe), `${m[1]} — ${probe} is in a stylesheet`);
      }
    }
    assert.ok(checked > 0, 'the scan found the // css markers');
  });

  test('every SELECTORS key the content script reads exists', () => {
    // A missing key would be read as `undefined` and silently yield an empty
    // NodeList, so the pass would just do nothing. Scan the content script for
    // the keys it names and require each one.
    const source = readFileSync(
      new URL('../src/content/ux.js', import.meta.url),
      'utf8',
    );
    let checked = 0;
    for (const m of source.matchAll(/SELECTORS\.([a-z]+)\.([A-Za-z0-9_]+)/g)) {
      checked += 1;
      assert.equal(
        typeof SELECTORS[m[1]]?.[m[2]],
        'string',
        `SELECTORS.${m[1]}.${m[2]} is read by content/ux.js`,
      );
    }
    assert.ok(checked > 0, 'the scan found the content script’s selector reads');
  });
});
