/**
 * gitalike — the UX tables.
 *
 * The skin is not only colour: the point of gitalike is that a GitHub site
 * *reads* like GitLab (and the other way round), so this file carries the
 * vocabulary, reference and keyboard differences between the two products.
 *
 * It is pure data plus side-effect-free helpers, published on
 * `globalThis.GITALIKE_UX` so the content script and the unit tests share one
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
      'pull requests': 'merge requests',
      'pull request': 'merge request',
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
      'merge requests': 'pull requests',
      'merge request': 'pull request',
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
      Issues: 'Work items',
      'Pull requests': 'Merge requests',
      Insights: 'Analytics',
      Projects: 'Issue boards',
    },
    github: {
      Repository: 'Code',
      'CI/CD': 'Actions',
      'Work items': 'Issues',
      Pipelines: 'Actions',
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

  // Account/menu chrome, where the two products name the same thing differently
  // but the wording is too generic to translate in prose (a bare "Settings"
  // means the repo tab, not preferences). Like LABELS, whole control labels
  // only, and every pair round-trips.
  const CHROME = {
    gitlab: {
      'Your repositories': 'Your projects',
      'Your gists': 'Your snippets',
      'Your stars': 'Starred projects',
      'Your organizations': 'Your groups',
    },
    github: {
      'Your projects': 'Your repositories',
      'Your snippets': 'Your gists',
      'Starred projects': 'Your stars',
      'Your groups': 'Your organizations',
    },
  };

  // Regions whose labels the NAV table is allowed to touch. Verified against
  // the live sites: GitHub's repo tabs live in `nav[aria-label="Repository"]`;
  // GitLab's project navigation is the `.super-sidebar`; Gitea/Forgejo (Codeberg,
  // gitea.com) put their repo tabs in an `overflow-menu` custom element.
  const NAV_SCOPE = [
    'nav[aria-label="Repository"]',
    '.js-repo-nav',
    '.super-sidebar',
    '[data-testid="super-sidebar"]',
    '.nav-sidebar',
    'nav[aria-label="Project navigation"]',
    'overflow-menu',
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
  // GitLab's sidebar order: Manage, Plan, Code, Build, Deploy, Monitor, Analyze,
  // then Settings. Shared by the GitHub tab bar and Gitea's `overflow-menu`, so
  // the two sources cannot drift. Labels a source does not have simply rank
  // after the known ones, so one list fits both.
  const GITLAB_REPO_ORDER = [
    'Members',
    'Work items',
    'Issue boards',
    'Wiki',
    'Milestones',
    'Labels',
    'Merge requests',
    'Repository',
    'Branches',
    'Commits',
    'Tags',
    'CI/CD',
    'Releases',
    'Packages',
    'Environments',
    'Incidents',
    'Analytics',
    'Security',
    'Settings',
  ];

  const NAV_RULES = {
    gitlab: [
      {
        container: 'nav[aria-label="Repository"] ul.UnderlineNav-body',
        item: 'li',
        order: GITLAB_REPO_ORDER,
      },
      {
        // Gitea/Forgejo (Codeberg, gitea.com) repo tabs: a flat `overflow-menu`
        // list of `a.item`s, so they take GitLab's order the same way.
        container: 'overflow-menu .overflow-menu-items',
        item: 'a.item',
        order: GITLAB_REPO_ORDER,
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

  // The GitLab project sidebar groups its items (Plan, Code, Build, …). GitHub's
  // repo tabs are flat, so on the GitLab skin they are gathered under the same
  // group headings, using the *displayed* label (after translation). An item not
  // listed here stands alone, with no heading.
  const NAV_GROUPS = {
    gitlab: {
      Members: 'Manage',
      'Work items': 'Plan',
      'Issue boards': 'Plan',
      Wiki: 'Plan',
      Milestones: 'Plan',
      Labels: 'Plan',
      'Merge requests': 'Code',
      Repository: 'Code',
      Branches: 'Code',
      Commits: 'Code',
      Tags: 'Code',
      'CI/CD': 'Build',
      Releases: 'Deploy',
      Packages: 'Deploy',
      Environments: 'Deploy',
      Incidents: 'Monitor',
      Analytics: 'Analyze',
      Security: 'Secure',
    },
  };

  // Menu items the *applied* product has no page for, by their displayed label
  // (after translation). They are hidden rather than marked, so the navigation
  // is the applied product's menu and not a mix of both.
  const NAV_HIDE = {
    // GitLab's sidebar items with no GitHub counterpart.
    github: [
      'Feature catalog',
      'Activity',
      'Epics',
      'Iterations',
      'Requirements',
      'Test cases',
      'Artifacts',
      'Terraform modules',
      'Model registry',
      'Model experiments',
      'Service Desk',
      'Incidents',
      'Error tracking',
      'On-call schedules',
      'Alert management',
      'Value stream analytics',
      'Pipeline schedules',
      'Locked files',
      'Repository graph',
      'Compare revisions',
    ],
    // GitHub's items with no GitLab counterpart.
    gitlab: ['Discussions', 'Sponsors', 'Marketplace'],
  };

  // On some skins the menu is a *whitelist*: only the applied product's own
  // project-page options are shown, so the navigation is that product's menu
  // exactly rather than the source product's menu with a few items hidden.
  // These are GitHub's repo tabs, after translation.
  const NAV_KEEP = {
    github: [
      'Code',
      'Issues',
      'Pull requests',
      'Actions',
      'Projects',
      'Wiki',
      'Security',
      'Insights',
      'Settings',
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
      Marketplace: 'GitLab',
    },
    github: {
      'Feature catalog': 'GitHub',
      Activity: 'GitHub',
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

  // Compile each theme's phrases into one alternation, longest key first. JS
  // tries the alternatives left to right at a given position, so the longest
  // phrase still wins; the whole string is scanned once rather than once per
  // phrase. The replacement is looked up in the map, so a rewritten phrase is
  // never fed back through another rule.
  const compiled = {};
  function rulesFor(theme) {
    if (!compiled[theme]) {
      const map = PHRASES[theme] || {};
      const keys = Object.keys(map).sort((a, b) => b.length - a.length);
      compiled[theme] = keys.length
        ? [
            new RegExp(
              `(?<![\\p{L}\\p{N}])(?:${keys.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`,
              'gu',
            ),
            map,
          ]
        : [null, map];
    }
    return compiled[theme];
  }

  /** Rewrite one string of page copy for the given theme. Never partial-word. */
  function translate(text, theme) {
    if (!text) return text;
    const [re, map] = rulesFor(theme);
    if (!re) return text;
    return text.replace(re, (match) => map[match]);
  }

  // An own-property lookup that treats a prototype key ("constructor") as a
  // miss, so a label can never match inherited state. Shared by every exact
  // table so the guard is written once.
  function lookup(map, label) {
    return map && Object.prototype.hasOwnProperty.call(map, label)
      ? map[label]
      : null;
  }

  /**
   * The exact replacement for a control's whole label — the LABELS/CHROME word
   * for it — or null when no whole label matches.
   *
   * Callers must test the *original* label with this before falling back to
   * `translate`: if phrase translation runs first, a label that contains a
   * phrase ("Merge pull request") is mangled to "Merge merge request" and the
   * exact entry can no longer be found.
   */
  function controlLabel(label, theme) {
    return lookup(LABELS[theme], label) ?? lookup(CHROME[theme], label);
  }

  /** Translate a control's whole label: exact words first, then copy. */
  function translateControl(label, theme) {
    return controlLabel(label, theme) ?? translate(label, theme);
  }

  /** The product that lacks this feature, or null if it has a counterpart. */
  function noEquivalentFor(label, theme) {
    return lookup(UNMAPPED[theme], label);
  }

  /**
   * The reference marker a link should show for the given theme. A GitHub
   * `/pull/N` or GitLab `/-/merge_requests/N` link becomes `!N` under the
   * GitLab UI and `#N` under the GitHub UI. Gitea/Forgejo use `/pulls/N`, so
   * that form is matched too. Anything else (issues, files)
   * returns null and is left alone.
   */
  function refMarker(href, theme) {
    if (!href) return null;
    const match = String(href).match(/\/(?:pulls?|merge_requests)\/(\d+)(?:[/?#]|$)/);
    if (!match) return null;
    return (theme === 'gitlab' ? '!' : '#') + match[1];
  }

  /** Does a control's text match a whole label, counter and all? */
  function labelMatches(text, label) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    return normalized === label || normalized.startsWith(`${label} `);
  }

  /** The GitLab-style group heading a nav item belongs under, or null. */
  function navGroupFor(label, theme) {
    const map = NAV_GROUPS[theme];
    if (!map) return null;
    for (const [key, group] of Object.entries(map)) {
      if (labelMatches(label, key)) return group;
    }
    return null;
  }

  /** Does the applied product have no page for this nav item? */
  function navHidden(label, theme) {
    const list = NAV_HIDE[theme];
    if (!list) return false;
    return list.some((key) => labelMatches(label, key));
  }

  /**
   * Is this nav item one the applied product's own project menu shows? True when
   * the theme has no whitelist (then everything is kept). A label may carry a
   * counter ("Pull requests -", "Pull requests 387") but not extra words, so
   * "Actions analytics" does not count as "Actions".
   */
  function navKeep(label, theme) {
    const list = NAV_KEEP[theme];
    if (!list) return true;
    return list.some((key) => {
      if (label === key) return true;
      return new RegExp(`^${escapeRe(key)}\\s+[\\d,.-]+$`).test(label);
    });
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

  /* ------------------------------------------------------ other host -- */

  // Only the two public forges have a known counterpart. A self-hosted instance
  // gives no way to guess its pair, so there the action is simply absent. Each
  // entry carries everything that is known about the host in one place: which
  // product it is (`from`), its counterpart (`host`) and how to name it.
  const HOST_PAIRS = {
    'github.com': { from: 'github', host: 'gitlab.com', product: 'GitHub' },
    'gitlab.com': { from: 'gitlab', host: 'github.com', product: 'GitLab' },
  };

  /** Parse a URL, or null when the string is not one. */
  function parseUrl(raw) {
    try {
      return new URL(raw);
    } catch {
      return null;
    }
  }

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

  // The route segment each forge uses for the same page. Only the GitHub side
  // is written down; the GitLab side is derived as its inverse, so a route can
  // never be added to one direction and forgotten in the other.
  const GITHUB_ROUTES = {
    pull: 'merge_requests',
    issues: 'issues',
    tree: 'tree',
    blob: 'blob',
    commits: 'commits',
    releases: 'releases',
    wiki: 'wikis',
    actions: 'pipelines',
  };
  const GITLAB_ROUTES = Object.fromEntries(
    Object.entries(GITHUB_ROUTES).map(([github, gitlab]) => [gitlab, github]),
  );

  // Map one product's path onto the other's. Returns null when the path is not
  // a repository (or is a GitLab group nested too deep for GitHub's owner/repo).
  function translatePath(pathname, from) {
    const seg = String(pathname || '').split('/').filter(Boolean);
    const gitlab = from !== 'github';

    // GitLab marks the project path off from the route with `/-/`; GitHub has
    // no marker, so the route begins at the third segment.
    let base;
    let route;
    if (gitlab) {
      const marker = seg.indexOf('-');
      const project = marker > 0 ? seg.slice(0, marker) : seg.slice(0, 2);
      if (project.length !== 2 || GITLAB_RESERVED.has(project[0])) return null;
      base = `/${project[0]}/${project[1]}`;
      route = marker > 0 ? seg.slice(marker + 1) : seg.slice(2);
    } else {
      if (seg.length < 2 || GITHUB_RESERVED.has(seg[0])) return null;
      base = `/${seg[0]}/${seg[1]}`;
      route = seg.slice(2);
    }

    const [head, ...tail] = route;
    if (!head) return base;

    // The merge-request list and detail pages name different segments on each
    // side (`pulls` vs `pull`), so those two forms are resolved first.
    if (!gitlab && head === 'pulls') return `${base}/-/merge_requests`;
    if (gitlab && head === 'merge_requests' && !tail.length) return `${base}/pulls`;

    const to = gitlab ? GITLAB_ROUTES[head] : GITHUB_ROUTES[head];
    if (!to) return base;
    const rest = tail.length ? `/${tail.join('/')}` : '';
    return gitlab ? `${base}/${to}${rest}` : `${base}/-/${to}${rest}`;
  }

  /** The same page on the other forge, or null if there is no known pair. */
  function otherHostUrl(raw) {
    const url = parseUrl(raw);
    const pair = url && HOST_PAIRS[url.hostname];
    if (!pair) return null;
    const path = translatePath(url.pathname, pair.from);
    if (!path) return null;
    return `https://${pair.host}${path}${url.search}${url.hash}`;
  }

  /**
   * The product a forge URL belongs to — 'GitHub', 'GitLab' — or null when the
   * host is not one of the two known forges. Lets the popup label the "open on
   * the other host" action without hardcoding which host is which.
   */
  function hostProduct(raw) {
    const url = parseUrl(raw);
    return (url && HOST_PAIRS[url.hostname]?.product) ?? null;
  }

  globalThis.GITALIKE_UX = {
    PHRASES,
    NAV,
    NAV_GROUPS,
    NAV_HIDE,
    NAV_KEEP,
    LABELS,
    CHROME,
    UNMAPPED,
    NAV_SCOPE,
    LABEL_SCOPE,
    NAV_RULES,
    SHORTCUTS,
    SHORTCUT_TARGETS,
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
    otherHostUrl,
    hostProduct,
  };
})();
