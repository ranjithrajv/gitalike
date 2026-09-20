/**
 * Git Same — the UX tables.
 *
 * The skin is not only colour: the point of Git Same is that a GitHub site
 * *reads* like GitLab (and the other way round), so this file carries the
 * vocabulary, reference and keyboard differences between the two products.
 *
 * It is pure data plus side-effect-free helpers, published on
 * `globalThis.GIT_SAME_UX` so the content script and the unit tests share one
 * source of truth. No DOM is touched here; `content/ux.js` does that.
 *
 * Every table is keyed by the theme being *applied*:
 *
 *   'gitlab'  a GitHub-flavoured site shown with the GitLab UI
 *               -> GitHub's words become GitLab's
 *   'github'  a GitLab-flavoured site shown with the GitHub UI
 *               -> GitLab's words become GitHub's
 */
(() => {
  'use strict';

  /* ------------------------------------------------------- terminology -- */

  // Multi-word copy, safe to fix up wherever it appears in normal page text
  // (outside code, inputs and editable regions). Longest key wins, so
  // "Pull requests" is rewritten before "Pull request".
  const PHRASES = {
    gitlab: {
      'Pull requests': 'Merge requests',
      'Pull request': 'Merge request',
      'Go to file': 'Find file',
      Gists: 'Snippets',
      Gist: 'Snippet',
      Insights: 'Analytics',
      Codespaces: 'Workspaces',
      'GitHub Actions': 'CI/CD',
      Dependabot: 'Dependency scanning',
    },
    github: {
      'Merge requests': 'Pull requests',
      'Merge request': 'Pull request',
      'Find file': 'Go to file',
      Snippets: 'Gists',
      Snippet: 'Gist',
      Analytics: 'Insights',
      Workspaces: 'Codespaces',
      'CI/CD': 'Actions',
      'Dependency scanning': 'Dependabot',
    },
  };

  // Short app-navigation labels. These are only replaced when an element's
  // *whole* trimmed label matches, and only inside a navigation region — so a
  // bare "Actions" in a marketing menu can never be rewritten to "CI/CD".
  const NAV = {
    gitlab: {
      Code: 'Repository',
      Actions: 'CI/CD',
      'Pull requests': 'Merge requests',
      Insights: 'Analytics',
      Projects: 'Issue boards',
    },
    github: {
      Repository: 'Code',
      'CI/CD': 'Actions',
      'Merge requests': 'Pull requests',
      Analytics: 'Insights',
      'Issue boards': 'Projects',
    },
  };

  // Exact labels on *controls* — buttons, menu items, tabs, links — that name a
  // GitHub/GitLab feature differently but should never be rewritten in prose.
  // Kept apart from PHRASES because "Merge" and "Rebase" are ordinary words:
  // scoping to a control's whole label is what makes them safe. Every entry
  // round-trips with its counterpart in the other direction.
  const LABELS = {
    gitlab: {
      'Merge pull request': 'Merge',
      'Squash and merge': 'Squash commits',
      'Rebase and merge': 'Rebase',
      'Security and quality': 'Security',
    },
    github: {
      Merge: 'Merge pull request',
      'Squash commits': 'Squash and merge',
      Rebase: 'Rebase and merge',
      Security: 'Security and quality',
    },
  };

  // Elements whose whole label the LABELS table may replace.
  const LABEL_SCOPE = [
    'a',
    'button',
    'summary',
    'label',
    '[role="button"]',
    '[role="tab"]',
    '[role="menuitem"]',
  ].join(',');

  // Regions whose labels the NAV table is allowed to touch. Verified against
  // the live sites: GitHub's repo tabs live in `nav[aria-label="Repository"]`;
  // GitLab's project navigation is the `.super-sidebar`.
  const NAV_SCOPE = [
    'nav[aria-label="Repository"]',
    '.js-repo-nav',
    '.super-sidebar',
    '[data-testid="super-sidebar"]',
    '.nav-sidebar',
    'nav[aria-label="Project navigation"]',
  ].join(',');

  // Desired left-to-right / top-to-bottom order of the app navigation, using
  // the *displayed* labels after translation. Items that are not present are
  // skipped; unrecognised items keep their relative order at the end. Only the
  // items are moved, into the slots they already occupy, so children we do not
  // understand stay put.
  //
  // GitHub's repo tabs are a flat `ul.UnderlineNav-body`, so they can be
  // reordered. GitLab's project navigation is a nested group tree with no flat
  // parent, so there is no safe reorder rule for that direction — it is
  // relabelled only.
  const NAV_RULES = {
    gitlab: [
      {
        container: 'nav[aria-label="Repository"] ul.UnderlineNav-body',
        item: 'li',
        order: [
          'Repository',
          'Issues',
          'Merge requests',
          'CI/CD',
          'Wiki',
          'Analytics',
          'Security',
        ],
      },
    ],
    github: [],
  };

  /* ---------------------------------------------------------- shortcuts -- */

  // Two-key `g` combos. Keyed by the theme being applied; each entry maps the
  // combo a user *sees* (the product on screen) to the combo the underlying
  // site actually implements. Only unambiguous pairs are listed — anything
  // else is left to the site.
  //
  //   on a GitHub site shown as GitLab:  g m (merge requests) -> GitHub g p
  //   on a GitLab site shown as GitHub:  g p (pull requests)  -> GitLab g m
  const SHORTCUTS = {
    gitlab: { gm: 'gp', gp: 'gb', gt: 'gn' },
    github: { gp: 'gm', gb: 'gp', gn: 'gt' },
  };

  /* ------------------------------------------------------ pure helpers -- */

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Compile each theme's rules once, longest key first.
  const compiled = {};
  function rulesFor(theme) {
    if (!compiled[theme]) {
      const map = PHRASES[theme] || {};
      compiled[theme] = Object.keys(map)
        .sort((a, b) => b.length - a.length)
        .map((key) => [
          new RegExp(
            `(?<![\\p{L}\\p{N}])${escapeRe(key)}(?![\\p{L}\\p{N}])`,
            'gu',
          ),
          map[key],
        ]);
    }
    return compiled[theme];
  }

  /** Rewrite one string of page copy for the given theme. Never partial-word. */
  function translate(text, theme) {
    if (!text) return text;
    let out = text;
    for (const [re, value] of rulesFor(theme)) out = out.replace(re, value);
    return out;
  }

  /** Translate an app-navigation label: exact single words first, then copy. */
  function translateLabel(label, theme) {
    const map = NAV[theme];
    if (map && Object.prototype.hasOwnProperty.call(map, label)) {
      return map[label];
    }
    return translate(label, theme);
  }

  /** Translate a control's whole label: exact words first, then copy. */
  function translateControl(label, theme) {
    const map = LABELS[theme];
    if (map && Object.prototype.hasOwnProperty.call(map, label)) {
      return map[label];
    }
    return translate(label, theme);
  }

  /**
   * The reference marker a link should show for the given theme. A GitHub
   * `/pull/N` or GitLab `/-/merge_requests/N` link becomes `!N` under the
   * GitLab UI and `#N` under the GitHub UI. Anything else (issues, files)
   * returns null and is left alone.
   */
  function refMarker(href, theme) {
    if (!href) return null;
    const match = String(href).match(/\/(?:pull|merge_requests)\/(\d+)(?:[/?#]|$)/);
    if (!match) return null;
    return (theme === 'gitlab' ? '!' : '#') + match[1];
  }

  /**
   * Indices of `labels`, arranged by their position in `order` (stable for
   * equal ranks). Prefix matching means a label carrying a counter
   * ("Pull requests 387") still ranks. Unknown labels sort after the known
   * ones, in their original relative order.
   */
  function orderIndexes(labels, order) {
    const rank = (label) => {
      for (let i = 0; i < order.length; i += 1) {
        if (label.startsWith(order[i])) return i;
      }
      return order.length;
    };
    return labels
      .map((label, index) => ({ index, rank: rank(label) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map((entry) => entry.index);
  }

  /** `labels` reordered — `orderItems` built on `orderIndexes`. */
  function orderItems(labels, order) {
    return orderIndexes(labels, order).map((index) => labels[index]);
  }

  globalThis.GIT_SAME_UX = {
    PHRASES,
    NAV,
    LABELS,
    NAV_SCOPE,
    LABEL_SCOPE,
    NAV_RULES,
    SHORTCUTS,
    translate,
    translateLabel,
    translateControl,
    refMarker,
    orderIndexes,
    orderItems,
  };
})();
