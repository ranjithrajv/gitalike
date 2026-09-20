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
  // reordered. GitLab's project navigation is a nested group tree — each group
  // is its own `ul` — so there is no single flat list to reorder; the one group
  // that maps onto GitHub's repo tabs, the repository ("Code") group, is
  // reordered in place. A rule with `scope` + `contains` resolves its container
  // at runtime (the group whose children include that exact label).
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
    github: [
      {
        scope: '.super-sidebar',
        contains: 'Code',
        item: 'li',
        order: [
          'Code',
          'Issues',
          'Pull requests',
          'Actions',
          'Projects',
          'Wiki',
          'Security',
          'Insights',
        ],
      },
    ],
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

  // Some sites ignore synthetic key events (`event.isTrusted` is false), so the
  // combo cannot be replayed into them. Where the destination has a real
  // navigation link, deliver the shortcut as a click on that link instead —
  // a trusted navigation the site always honours. Keyed by theme + combo, with
  // the *displayed* label (after translation) to look for.
  const SHORTCUT_TARGETS = {
    gitlab: {},
    github: { gp: 'Pull requests', gb: 'Projects' },
  };

  /* ------------------------------------------------------- no counterpart -- */

  // Features that exist in one product but have no counterpart in the other.
  // Keyed by the theme being applied, with the product that *lacks* the feature
  // as the value, so the UI can say so instead of pretending it exists. These
  // are deliberately absent from PHRASES/NAV/LABELS — there is nothing to
  // translate them to.
  const UNMAPPED = {
    gitlab: {
      Discussions: 'GitLab',
      Sponsors: 'GitLab',
    },
    github: {
      Epics: 'GitHub',
      Iterations: 'GitHub',
      Requirements: 'GitHub',
      'Service Desk': 'GitHub',
      'Merge trains': 'GitHub',
      'Feature flags': 'GitHub',
      'Terraform modules': 'GitHub',
      'Model registry': 'GitHub',
      'Model experiments': 'GitHub',
      'Test cases': 'GitHub',
      Incidents: 'GitHub',
      'Error tracking': 'GitHub',
      'On-call schedules': 'GitHub',
      'Alert management': 'GitHub',
      'Value stream analytics': 'GitHub',
    },
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

  /** The product that lacks this feature, or null if it has a counterpart. */
  function noEquivalentFor(label, theme) {
    const map = UNMAPPED[theme];
    if (map && Object.prototype.hasOwnProperty.call(map, label)) return map[label];
    return null;
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

  /** Does a control's text match a whole label, counter and all? */
  function labelMatches(text, label) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    return normalized === label || normalized.startsWith(`${label} `);
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

  /* ------------------------------------------------------ other host -- */

  // Only the two public forges have a known counterpart. A self-hosted instance
  // gives no way to guess its pair, so there the action is simply absent.
  const HOST_PAIRS = { 'github.com': 'gitlab.com', 'gitlab.com': 'github.com' };

  // First path segments that name a product-wide page, not a repository, so
  // they are never mistaken for an owner/repo pair.
  const GITHUB_RESERVED = new Set([
    'settings', 'notifications', 'explore', 'marketplace', 'orgs', 'users',
    'login', 'logout', 'signup', 'features', 'about', 'pricing', 'topics',
    'collections', 'sponsors', 'apps', 'codespaces', 'issues', 'pulls',
    'search', 'new', 'dashboard', 'account', 'organizations', 'enterprise',
    'security', 'customer-stories', 'readme', 'sponsors',
  ]);
  const GITLAB_RESERVED = new Set([
    'dashboard', 'explore', 'users', 'admin', 'projects', 'groups', 'help',
    'search', 'profile', 'public', 'sign_in', 'oauth', 'import', 'invites',
  ]);

  // Map one product's path onto the other's. Returns null when the path is not
  // a repository (or is a GitLab group nested too deep for GitHub's owner/repo).
  function translatePath(pathname, from) {
    const seg = String(pathname || '').split('/').filter(Boolean);

    if (from === 'github') {
      if (seg.length < 2 || GITHUB_RESERVED.has(seg[0])) return null;
      const base = `/${seg[0]}/${seg[1]}`;
      const [head, ...tail] = seg.slice(2);
      if (!head) return base;
      const rest = tail.length ? `/${tail.join('/')}` : '';
      switch (head) {
        case 'pull': return `${base}/-/merge_requests${rest}`;
        case 'pulls': return `${base}/-/merge_requests`;
        case 'issues': return `${base}/-/issues${rest}`;
        case 'tree': return `${base}/-/tree${rest}`;
        case 'blob': return `${base}/-/blob${rest}`;
        case 'commits': return `${base}/-/commits${rest}`;
        case 'releases': return `${base}/-/releases${rest}`;
        case 'wiki': return `${base}/-/wikis${rest}`;
        case 'actions': return `${base}/-/pipelines${rest}`;
        default: return base;
      }
    }

    // GitLab: the `/-/` marker separates the project path from the route. A
    // project path deeper than owner/repo (a subgroup) has no GitHub form.
    const marker = seg.indexOf('-');
    const project = marker > 0 ? seg.slice(0, marker) : seg.slice(0, 2);
    const route = marker > 0 ? seg.slice(marker + 1) : seg.slice(2);
    if (project.length !== 2 || GITLAB_RESERVED.has(project[0])) return null;
    const base = `/${project[0]}/${project[1]}`;
    const [head, ...tail] = route;
    if (!head) return base;
    const rest = tail.length ? `/${tail.join('/')}` : '';
    switch (head) {
      case 'merge_requests': return tail.length ? `${base}/pull${rest}` : `${base}/pulls`;
      case 'issues': return `${base}/issues${rest}`;
      case 'tree': return `${base}/tree${rest}`;
      case 'blob': return `${base}/blob${rest}`;
      case 'commits': return `${base}/commits${rest}`;
      case 'releases': return `${base}/releases${rest}`;
      case 'wikis': return `${base}/wiki${rest}`;
      case 'pipelines': return `${base}/actions${rest}`;
      default: return base;
    }
  }

  /** The same page on the other forge, or null if there is no known pair. */
  function otherHostUrl(raw) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      return null;
    }
    const target = HOST_PAIRS[url.hostname];
    if (!target) return null;
    const from = url.hostname === 'github.com' ? 'github' : 'gitlab';
    const path = translatePath(url.pathname, from);
    if (!path) return null;
    return `https://${target}${path}${url.search}${url.hash}`;
  }

  globalThis.GIT_SAME_UX = {
    PHRASES,
    NAV,
    LABELS,
    UNMAPPED,
    NAV_SCOPE,
    LABEL_SCOPE,
    NAV_RULES,
    SHORTCUTS,
    SHORTCUT_TARGETS,
    translate,
    translateLabel,
    translateControl,
    noEquivalentFor,
    refMarker,
    labelMatches,
    orderIndexes,
    orderItems,
    translatePath,
    otherHostUrl,
  };
})();
