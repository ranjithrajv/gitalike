/**
 * GitAlike — the UX tables.
 *
 * The skin is not only colour: the point of GitAlike is that a GitHub site
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

  // The skin vocabulary and order tables are declared one file per skin under
  // `plugins/skins/`, registering with `plugins/core.js`; `lib/skins.js` derives
  // the flat tables and is loaded first everywhere (background CONTENT_JS, the
  // Firefox manifest, popup.html, the tests).
  if (!globalThis.GITALIKE_SKINS) {
    throw new Error(
      'GitAlike: the plugin registry must be loaded before ux.js',
    );
  }
  const {
    PHRASES,
    NAV,
    LABELS,
    CHROME,
    UNMAPPED,
    TOPBAR_HIDE,
    SHORTCUTS,
    SHORTCUT_TARGETS,
    NAV_HIDE,
    NAV_KEEP,
    NAV_GROUPS,
    NAV_RULES,
    PROJECT_TABS,
    PROFILE_MENU,
  } = globalThis.GITALIKE_SKINS;

  // The source markup hooks and the canary pages are declared one file per
  // source under `plugins/sources/`; `lib/sources.js` derives them. Loaded first
  // everywhere, like `lib/skins.js`.
  if (!globalThis.GITALIKE_SOURCES) {
    throw new Error(
      'GitAlike: the plugin registry must be loaded before ux.js',
    );
  }
  const { SELECTORS, CANARY_PAGES } = globalThis.GITALIKE_SOURCES;

  /* ------------------------------------------------------- terminology -- */

  // Bitbucket Cloud's repository bar, by its displayed labels. Its classes are
  // hashed, so a pass finds the bar by content — the ancestor holding the most
  // of these — rather than by a selector that would rot. Both the source's own
  // words and the applied product's are listed: the copy pass relabels some of
  // them before this runs.
  const BITBUCKET_NAV_WORDS = [
    'Source',
    'Repository',
    'Code',
    'Commits',
    'Branches',
    'Pull requests',
    'Merge requests',
    'Pipelines',
    'CI/CD',
    'Actions',
    'Deployments',
    'Jira issues',
    'Issues',
    'Work items',
    'Security',
    'Downloads',
  ];

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

  // The global top bar, both products' logged-out marketing header and the
  // signed-in app bars. A separate scope from NAV_SCOPE because the top bar's
  // words are handled differently (see TOPBAR_HIDE).
  const TOPBAR_SCOPE = [
    'header[role="banner"]',
    '.js-header-wrapper',
    'header.navigation',
    'header.super-topbar',
    'header.GlobalNav',
    'header[aria-label="Global navigation menu"]',
    '.navbar-gitlab',
    '.header-content',
    '.super-topbar',
    '.AppHeader',
  ].join(',');

  /* ---------------------------------------------------------- selectors -- */

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
   * GitLab UI and `#N` under the GitHub UI. Gitea/Forgejo use `/pulls/N` and
   * Bitbucket `/pull-requests/N`, so both are matched too. Anything else
   * (issues, files) returns null and is left alone.
   */
  function refMarker(href, theme) {
    if (!href) return null;
    const match = String(href).match(
      /\/(?:pulls?|pull-requests|merge_requests)\/(\d+)(?:[/?#]|$)/,
    );
    if (!match) return null;
    return (theme === 'gitlab' ? '!' : '#') + match[1];
  }

  /**
   * A nav label with its counter removed. Each forge renders the count its own
   * way: GitLab "Pull requests 387" (and "-" when the count is empty), GitHub
   * "Issues 5k+", Gitea "Issues1.5k" with no separator between the two at all.
   * Only a trailing counter goes — extra *words* stay, so "Actions analytics"
   * keeps them and is still not "Actions".
   */
  function withoutCounter(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s*(?:[\d,.]+[kKmM]?\+?|-)$/, '');
  }

  /** Does a control's text match a whole label, counter and all? */
  function labelMatches(text, label) {
    return withoutCounter(text) === label;
  }

  /** The group heading a nav item belongs under for a skin, or null. */
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
   * the theme has no whitelist (then everything is kept). The counter is taken
   * off by `withoutCounter`, so every forge's spelling of it is kept — including
   * Gitea's "Issues1.5k", which has no separator — while extra *words* are not a
   * counter, so "Actions analytics" still does not count as "Actions".
   */
  function navKeep(label, theme) {
    const list = NAV_KEEP[theme];
    if (!list) return true;
    return list.includes(withoutCounter(label));
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

  /* ---------------------------------------------- pure view decisions -- */

  // The GitLab pages that map onto a GitHub repo tab, keyed by GitLab's
  // `body[data-page]`, so the tab the applied UI would underline can be picked
  // without a page. Pure, so it is unit-tested rather than only seen live.
  const ACTIVE_TABS = [
    [
      /^projects:(show|tree|blob|commits|compare|branches|tags|forks|network)\b/,
      'Code',
    ],
    [/^projects:work_items\b/, 'Issues'],
    [/^projects:merge_requests\b/, 'Pull requests'],
    [/^projects:(pipelines|jobs|builds|ci)\b/, 'Actions'],
    [/^projects:boards\b/, 'Projects'],
    [/^projects:(security|vulnerabilities)\b/, 'Security and quality'],
    [/^projects:wikis\b/, 'Wiki'],
    [/^projects:(insights|analytics)\b/, 'Insights'],
  ];

  /**
   * The repo tab a GitLab page should mark active, in the *applied* product's
   * words: the table maps to GitHub's label, then `NAV` renames it for the skin
   * (Code → Source, Actions → Pipelines for Bitbucket).
   */
  function activeTabFor(page, target = 'github') {
    const rule = ACTIVE_TABS.find(([re]) => re.test(String(page || '')));
    if (!rule) return null;
    const label = rule[1];
    return (NAV[target] && NAV[target][label]) || label;
  }

  // GitHub puts a counter inside a metadata section heading ("Releases240
  // (240)"), so the digits and their brackets are stripped before the label is
  // compared.
  const sectionLabelText = (text) =>
    String(text || '')
      .replace(/[\d,()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // GitHub's About sections that GitLab's "Project information" block does not
  // list, matched by `sectionLabelText`.
  const METADATA_HIDE = [
    'Releases',
    'Packages',
    'Used by',
    'Contributors',
    'Languages',
  ];

  /** The repo tabs `target` shows on a GitLab project page. */
  function projectTabs(base, hrefs = {}, target = 'github') {
    const build = PROJECT_TABS[target] || PROJECT_TABS.github;
    return build(base, hrefs);
  }

  // Gitea/Forgejo's repo navigation, arranged as the applied skin's menu: the
  // items the page renders, relabelled to the applied product, ordered by the
  // same rule the live reorder uses, filtered to the skin's own tabs, and
  // gathered under that skin's group headings. `items` is
  // `{ href, label, active }` read from the page (label without its counter);
  // the result mixes `{ group }` headings with `{ href, label, raw, active }`
  // rows, so the DOM builder and the unit tests share one decision.
  //
  // Grouping and filtering follow the *skin*, not the layout. Two skins can share
  // a shape (GitLab and Bitbucket are both left sidebars) while differing on both
  // counts: GitLab groups its sidebar and shows extra items, Bitbucket is a flat
  // list of its own tabs. Keying on the layout put GitLab's groups and items on
  // Bitbucket's sidebar.
  function repoNav(items, theme, order) {
    const nav = NAV[theme] || {};
    const labels = items.map(
      (item) => nav[item.label] ?? translate(item.label, theme),
    );
    const keep = NAV_KEEP[theme];
    const visible = (label) =>
      keep ? navKeep(label, theme) : !navHidden(label, theme);
    const entries = [];
    let last = null;
    for (const index of orderIndexes(labels, order || [])) {
      const label = labels[index];
      if (!visible(label)) continue;
      const group = navGroupFor(label, theme);
      if (group && group !== last) {
        entries.push({ group });
        last = group;
      }
      entries.push({
        href: items[index].href,
        label,
        raw: items[index].label,
        active: Boolean(items[index].active),
      });
    }
    return entries;
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
    'settings',
    'notifications',
    'explore',
    'marketplace',
    'orgs',
    'users',
    'login',
    'logout',
    'signup',
    'features',
    'about',
    'pricing',
    'topics',
    'collections',
    'sponsors',
    'apps',
    'codespaces',
    'issues',
    'pulls',
    'search',
    'new',
    'dashboard',
    'account',
    'organizations',
    'enterprise',
    'security',
    'customer-stories',
    'readme',
    'sponsors',
  ]);
  const GITLAB_RESERVED = new Set([
    'dashboard',
    'explore',
    'users',
    'admin',
    'projects',
    'groups',
    'help',
    'search',
    'profile',
    'public',
    'sign_in',
    'oauth',
    'import',
    'invites',
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
    const seg = String(pathname || '')
      .split('/')
      .filter(Boolean);
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
    if (gitlab && head === 'merge_requests' && !tail.length)
      return `${base}/pulls`;

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

  /* --------------------------------------------------- forge discovery -- */

  // Which forge a link belongs to, guessed from the link alone, so the popup can
  // pre-select the product for a site it has not been told about instead of
  // always asking. Nothing is fetched — a hostname and a path are all it reads —
  // so this stays inside GitAlike's no-network promise. A deep link is the
  // reliable signal: the two big forges spell the same page differently, and a
  // host we have never seen still reveals itself in its routes.

  // Bundled hosts are known outright, and which markup family each belongs to
  // lives in sites.js (`builtin` and `SOURCES`). Read it there rather than
  // repeat the table, so a new bundled forge is one edit. `sites.js` is loaded
  // alongside this file by every context; when this module is imported on its
  // own it is absent, and a bundled host simply falls through to the path and
  // host hints below.
  function bundledSource(host) {
    const sites = globalThis.GITALIKE;
    if (!sites?.isBuiltin?.(host)) return null;
    return sites.sourceFor(host, null);
  }

  // A self-hosted instance often names its product in the host, which is worth a
  // low-confidence guess when the path says nothing (a bare repository root).
  const HOST_HINTS = [
    [/(?:^|\.)github\./, 'github'],
    [/(?:^|\.)gitlab\./, 'gitlab'],
    [/(?:^|\.)(?:codeberg|gitea|forgejo)\./, 'gitea'],
    [/(?:^|\.)bitbucket\./, 'bitbucket'],
    [/gerrit/, 'gerrit'],
  ];

  // Distinctive routes, checked in order against `pathname + hash`. GitLab's
  // `/-/` separator must be tested before GitHub's bare `/blob/`, and Gitea's
  // `/pulls/` before GitHub's `/pull/`.
  const PATH_FORGE = [
    // Gerrit: /c/<project>/+/<change>, and the legacy /#/c/<change> form. A
    // Gerrit project can be nested (`/c/foo/bar/+/1`), so the middle is `.+`.
    [/(?:^|\/)c\/.+\/\+/, 'gerrit'],
    [/#\/c\/\d+/, 'gerrit'],
    // Bitbucket Server / Data Center: /projects/<KEY>/repos/<slug>/…
    [/^\/projects\/[^/]+\/repos\//, 'bitbucket'],
    // Bitbucket Cloud: /<workspace>/<repo>/pull-requests/<n>
    [/(?:^|\/)pull-requests\/\d+/, 'bitbucket'],
    // GitLab: the /-/ route separator.
    [/(?:^|\/)-(\/|$)/, 'gitlab'],
    // Gitea / Forgejo: /<owner>/<repo>/pulls/<n> and /src/branch/<b>.
    [/(?:^|\/)pulls\/\d+/, 'gitea'],
    [/(?:^|\/)src\/branch\//, 'gitea'],
    // GitHub: /pull/<n> (Gitea is /pulls/), /blob/<ref>/, /tree/<ref>/.
    [/(?:^|\/)pull\/\d+/, 'github'],
    [/(?:^|\/)blob\/[^/]+/, 'github'],
    [/(?:^|\/)tree\/[^/]+/, 'github'],
  ];

  // A Gitea/Forgejo instance is classified as the GitHub-flavoured kind, so its
  // *product* button is GitHub even though its markup is its own.
  const kindForSource = (source) => (source === 'gitea' ? 'github' : source);

  /**
   * The forge a link looks like, or null when it says nothing useful. Returns
   * `{ source, kind, confidence, reason }`; `kind` is the product button the
   * popup would press. Accepts a full URL or a bare host, and never throws.
   */
  function guessForge(raw) {
    if (!raw) return null;
    const text = String(raw).trim();
    const url = parseUrl(text) || parseUrl(`https://${text}`);
    if (!url) return null;
    const host = url.hostname.toLowerCase();

    const known = bundledSource(host);
    if (known) {
      return {
        source: known,
        kind: kindForSource(known),
        confidence: 'high',
        reason: 'host',
      };
    }

    const where = `${url.pathname}${url.hash}`;
    for (const [re, source] of PATH_FORGE) {
      if (re.test(where)) {
        return {
          source,
          kind: kindForSource(source),
          confidence: 'high',
          reason: 'path',
        };
      }
    }

    for (const [re, source] of HOST_HINTS) {
      if (re.test(host)) {
        return {
          source,
          kind: kindForSource(source),
          confidence: 'low',
          reason: 'host',
        };
      }
    }
    return null;
  }

  globalThis.GITALIKE_UX = {
    PHRASES,
    NAV,
    NAV_GROUPS,
    NAV_HIDE,
    NAV_KEEP,
    BITBUCKET_NAV_WORDS,
    LABELS,
    CHROME,
    UNMAPPED,
    NAV_SCOPE,
    TOPBAR_SCOPE,
    TOPBAR_HIDE,
    LABEL_SCOPE,
    NAV_RULES,
    SELECTORS,
    CANARY_PAGES,
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
    activeTabFor,
    sectionLabelText,
    METADATA_HIDE,
    projectTabs,
    PROFILE_MENU,
    repoNav,
    otherHostUrl,
    hostProduct,
    guessForge,
  };
})();
