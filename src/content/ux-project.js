/**
 * GitAlike — UX content script: project pages.
 *
 * The metadata block, its heading, the rebuilt project tab strip and the active
 * tab; and Gitea/Forgejo's own rebuilt nav. See ux-core.js for the shared
 * runtime and ux.js for the entry point.
 */
(() => {
  'use strict';

  const rt = globalThis.GITALIKE_UX_RUNTIME;
  if (!rt) return;
  const {
    UX,
    SELECTORS,
    layoutOf,
    ledger,
    hide,
    textNodes,
    rememberText,
    cloneClean,
  } = rt;

  // GitLab's "Project information" lists a fixed set of items; GitHub's "About"
  // sidebar lists a different set (Releases, Packages, Used by, Contributors,
  // Languages). On the GitLab skin the GitHub-only sections are hidden so the
  // block shows the items GitLab's project page does.
  function paintMetadata(t) {
    if (layoutOf(t) !== 'gitlab') return;
    const grid = document.querySelector(SELECTORS.github.metadataSidebar);
    if (!grid) return;
    const source = document.documentElement.dataset.gsSource;
    const hidden = UX.METADATA_HIDE[source] ?? [];
    for (const section of grid.children) {
      const heading = section.querySelector('h2, h3');
      const label = UX.sectionLabelText(heading && heading.textContent);
      if (!hidden.includes(label)) continue;
      hide(section);
    }
  }

  // GitLab's About column ends with a "Created on" block, for which neither
  // GitHub's About nor Bitbucket's page has a counterpart, so it is hidden on
  // every non-GitLab skin. (Keyed on the theme, not the layout: Bitbucket shares
  // GitLab's sidebar layout but not its metadata.)
  function paintAboutExtras(t) {
    if (t === 'gitlab') return;
    for (const block of document.querySelectorAll(
      SELECTORS.gitlab.projectSidebarBlock,
    )) {
      if (!/^Created on\b/i.test(block.textContent.trim())) continue;
      hide(block, true);
    }
  }

  // Each product heads the repository metadata block differently — GitHub's
  // "About" sidebar, GitLab's "Project information" block. CSS moves the block;
  // the heading is renamed here so its label matches the product being imitated.
  function paintHeadings(t) {
    const rename = (heading, from, to) => {
      for (const text of textNodes(heading)) {
        if (text.nodeValue.trim() !== from) continue;
        rememberText(text);
        const next = text.nodeValue.replace(from, to);
        if (text.nodeValue !== next) text.nodeValue = next;
        return;
      }
    };
    // A heading whose label carries a trailing counter or hidden word ("Pinned
    // Loading") is matched by its prefix.
    const renamePrefix = (heading, from, to) => {
      for (const text of textNodes(heading)) {
        if (!text.nodeValue.trim().startsWith(from)) continue;
        rememberText(text);
        const next = text.nodeValue.replace(from, to);
        if (text.nodeValue !== next) text.nodeValue = next;
        return;
      }
    };
    if (t === 'gitlab') {
      const grid = document.querySelector(SELECTORS.github.metadataSidebar);
      if (grid) {
        for (const heading of grid.querySelectorAll('h2, h3')) {
          if (heading.textContent.trim() === 'About') {
            rename(heading, 'About', 'Project information');
          }
        }
      }
      // GitLab's profile shows a "Personal projects" section; GitHub's pinned
      // repositories are the closest thing to it.
      for (const heading of document.querySelectorAll('h2')) {
        // The heading's words are separate nodes split by newlines ("Pinned"
        // then a hidden "Loading"), so whitespace is normalized before matching.
        const text = heading.textContent.replace(/\s+/g, ' ').trim();
        if (text === 'Pinned' || text.startsWith('Pinned ')) {
          renamePrefix(heading, 'Pinned', 'Personal projects');
        }
      }
      return;
    }
    // Every non-GitLab target (GitHub, Bitbucket) reads GitLab's "Project
    // information" heading as "About" rather than leaving GitLab's word on it.
    const sidebar =
      document.querySelector(SELECTORS.gitlab.projectSidebarBlock) ||
      document.querySelector(SELECTORS.gitlab.projectLayoutSidebar);
    if (!sidebar) return;
    for (const heading of sidebar.querySelectorAll('h2, h3')) {
      if (heading.textContent.trim() === 'Project information') {
        rename(heading, 'Project information', 'About');
      }
    }
  }

  // GitLab's project sidebar scatters the same destinations across a pinned
  // block and collapsible groups (so items duplicate, and Wiki/Security are not
  // even rendered when the project has them disabled), and its group tree gives
  // no single list to reorder. The GitHub skin therefore rebuilds the strip as
  // GitHub's repo tabs, in GitHub's order (`UX.projectTabs`), reusing each link
  // GitLab does render and synthesising the tabs GitLab omits.
  function paintProjectTabs(t) {
    if (layoutOf(t) !== 'github') return;
    const page = (document.body && document.body.dataset.page) || '';
    if (!page.startsWith('projects:')) return;
    const sidebar = document.querySelector(SELECTORS.gitlab.superSidebar);
    if (!sidebar) return;
    const nav = sidebar.querySelector(SELECTORS.gitlab.navContainer);
    const anchors = [
      ...sidebar.querySelectorAll('a:not([data-gs-project-tab])'),
    ];
    const findHref = (labels) => {
      for (const a of anchors) {
        const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (labels.some((label) => UX.labelMatches(text, label))) {
          return a.getAttribute('href');
        }
      }
      return null;
    };
    const hrefs = {
      code: findHref(['Code', 'Repository']),
      issues: findHref(['Issues', 'Work items']),
      pullRequests: findHref(['Pull requests', 'Merge requests']),
      actions: findHref(['Actions', 'Pipelines', 'CI/CD']),
      projects: findHref(['Projects', 'Issue boards']),
      insights: findHref(['Insights', 'Analytics']),
    };
    const base = [hrefs.code, hrefs.issues, hrefs.actions]
      .filter(Boolean)
      .map((href) => href.split('/-/')[0])
      .find(Boolean);
    if (!base) return;
    const signature = `${base}:${location.pathname}`;
    // A document-wide lookup: once the row is hosted in the content it is no
    // longer inside the sidebar, and a nav-scoped lookup would miss it and
    // append a fresh copy on every flush.
    let list = document.querySelector('[data-gs-project-tabs]');
    if (list && list.getAttribute('data-gs-signature') === signature) return;
    if (list) list.remove();
    const tabs = UX.projectTabs(base, hrefs, t);
    list = document.createElement('ul');
    list.setAttribute('data-gs-project-tabs', '');
    list.setAttribute('data-gs-ux-skip', '');
    list.setAttribute('data-gs-signature', signature);
    for (const [label, href] of tabs) {
      const item = document.createElement('li');
      const anchor = document.createElement('a');
      anchor.className = 'super-sidebar-nav-item';
      anchor.setAttribute('data-gs-project-tab', '');
      anchor.setAttribute('href', href);
      anchor.textContent = label;
      item.appendChild(anchor);
      list.appendChild(item);
    }
    // GitHub puts the tab row under the repository header, not at the very top
    // of the page. When the project page has that header (the repository root),
    // the strip is hosted there and the sidebar shell is hidden by CSS; other
    // project pages keep the top strip.
    const files = document.querySelector(SELECTORS.gitlab.projectFiles);
    if (files && files.parentElement) {
      files.parentElement.insertBefore(list, files);
      list.setAttribute('data-gs-tab-host', 'content');
    } else if (nav) {
      nav.insertBefore(list, nav.firstChild);
      list.setAttribute('data-gs-tab-host', 'sidebar');
    } else {
      list.remove();
    }
  }

  // GitLab marks the project-name item active on the project overview rather
  // than the tab GitHub would underline, and its own highlight is a blue pill
  // rather than GitHub's underline. The page marker is mapped to GitHub's tab
  // (`UX.activeTabFor`) and that tab is marked here; the underline styling lives
  // in the theme.
  function paintActiveTab(t) {
    if (layoutOf(t) !== 'github') return;
    const page = (document.body && document.body.dataset.page) || '';
    const label = UX.activeTabFor(page, t);
    for (const anchor of document.querySelectorAll(
      `${SELECTORS.gitlab.superSidebar} a, [data-gs-project-tabs] a`,
    )) {
      const text = (anchor.textContent || '').replace(/\s+/g, ' ').trim();
      if (label && UX.labelMatches(text, label)) {
        anchor.setAttribute('data-gs-active', '');
      } else {
        anchor.removeAttribute('data-gs-active');
      }
    }
  }

  // The repo-relative base (`/owner/repo`) a Gitea page is on, or null.
  function giteaBase() {
    const segments = location.pathname.split('/').filter(Boolean);
    return segments.length >= 2 ? `/${segments[0]}/${segments[1]}` : null;
  }

  // GitHub always shows a Wiki tab and an Insights tab. Gitea renders neither,
  // but it does have a wiki route and an activity page, so under the GitHub skin
  // the two are added to the restyled row. (Security has no Gitea page and is not
  // invented.) Marked so a re-render does not add a second copy.
  function addGiteaGithubTabs(menu) {
    const base = giteaBase();
    if (!base) return;
    const row = menu.querySelector('.overflow-menu-items') || menu;
    const have = new Set(
      [...row.querySelectorAll('a.item')].map((a) => navItemLabel(a)),
    );
    const wanted = [
      ['Wiki', `${base}/wiki`],
      ['Insights', `${base}/activity`],
    ];
    for (const [label, href] of wanted) {
      if (have.has(label)) continue;
      if (row.querySelector(`[data-gs-gitea-added="${label}"]`)) continue;
      const anchor = document.createElement('a');
      anchor.className = 'item';
      anchor.setAttribute('data-gs-gitea-added', label);
      anchor.setAttribute('data-gs-ux-skip', '');
      anchor.setAttribute('href', href);
      anchor.textContent = label;
      row.appendChild(anchor);
    }
  }

  /** The label of a repo-nav item: its text without the counter pill. */
  function navItemLabel(anchor) {
    return textNodes(anchor)
      .filter(
        (n) => !n.parentElement || !n.parentElement.closest('.ui.small.label'),
      )
      .map((n) => n.nodeValue)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Gitea/Forgejo's repo navigation is an `overflow-menu` web component that
  // collapses its tabs into a "more" popup whenever they stop fitting — which is
  // every row once the nav is one column wide, so it cannot be the GitLab
  // sidebar itself. The GitHub skin can restyle it in place (its horizontal tab
  // row is already GitHub's shape); the GitLab skin rebuilds it instead, exactly
  // as the GitHub skin rebuilds GitLab's sidebar (`paintProjectTabs`). The
  // applied product's labels, order and group headings come from `UX.repoNav`;
  // the original menu is hidden by the stylesheet.
  function paintGiteaNav(t) {
    const layout = layoutOf(t);
    const menu = document.querySelector(SELECTORS.gitea.repoMenu);
    if (!menu) return;
    // The GitHub skin restyles Gitea's own row in place (its shape is already
    // GitHub's), so only the tabs Gitea omits are added here.
    if (layout === 'github') {
      addGiteaGithubTabs(menu);
      return;
    }
    if (layout !== 'gitlab') return;
    const anchors = [...menu.querySelectorAll('a.item')].filter((a) =>
      a.getAttribute('href'),
    );
    if (anchors.length < 2) return;
    const items = anchors
      .map((a) => ({
        href: a.getAttribute('href'),
        label: navItemLabel(a),
        active: a.classList.contains('active'),
      }))
      .filter((item) => item.label);
    if (items.length < 2) return;
    const rule = (UX.NAV_RULES[t] || []).find((r) => r.source === 'gitea');
    const entries = UX.repoNav(items, t, rule && rule.order);
    const signature = `${location.pathname}|${items
      .map((item) => `${item.href}:${item.label}:${item.active ? 1 : 0}`)
      .join('|')}`;
    const shell = menu.parentElement;
    if (!shell) return;
    let list = shell.querySelector('[data-gs-gitea-nav]');
    if (list && list.getAttribute('data-gs-signature') === signature) return;
    if (list) list.remove();

    const byRaw = new Map();
    anchors.forEach((anchor, index) => {
      if (items[index]) byRaw.set(items[index].label, anchor);
    });
    list = document.createElement('ul');
    list.setAttribute('data-gs-gitea-nav', '');
    list.setAttribute('data-gs-signature', signature);
    for (const entry of entries) {
      if (entry.group) {
        const heading = document.createElement('li');
        heading.className = 'gs-nav-group';
        heading.textContent = entry.group;
        list.appendChild(heading);
        continue;
      }
      const source = byRaw.get(entry.raw);
      if (!source) continue;
      const anchor = cloneClean(source);
      anchor.removeAttribute('id');
      anchor.classList.toggle('active', entry.active);
      // Relabel the item, leaving its icon and counter in place.
      const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const current = node.nodeValue.trim();
        if (!UX.labelMatches(current, entry.raw)) continue;
        node.nodeValue = node.nodeValue.replace(current, entry.label);
        break;
      }
      const item = document.createElement('li');
      item.appendChild(anchor);
      list.appendChild(item);
    }
    // Everything is already in the applied product's words, and the list must
    // not be re-painted as page copy, so the whole subtree opts out.
    list.setAttribute('data-gs-ux-skip', '');
    shell.insertBefore(list, menu);
  }

  // Bitbucket Cloud's repository bar is a row of buttons/spans whose classes are
  // hashed, so it is found by content — the ancestor holding the most of its
  // known labels — marked `data-gs-bb-nav` for the stylesheet to reorient, and
  // relabelled from the same NAV table the other sources use.
  // A Bitbucket account page's navigation is the workspace side nav, not the
  // repository bar; its words and its target labels are a different set.
  const BITBUCKET_PROFILE_WORDS = [
    'Overview',
    'Repositories',
    'Projects',
    'Packages',
    'Stars',
    'Activity',
    'Groups',
    'Snippets',
    'Followers',
    'Following',
    'For you',
    'Recent',
    'Pull requests',
  ];
  const BITBUCKET_PROFILE_MAP = {
    gitlab: {
      Repositories: 'Personal projects',
      Projects: 'Contributed projects',
      'Pull requests': 'Merge requests',
    },
    github: {},
    bitbucket: {},
  };

  function paintBitbucketNav(t) {
    if (document.documentElement.dataset.gsSource !== 'bitbucket') return;
    const path = location.pathname;
    const repoPage =
      /\/(src|commits|branches|pull-requests|pipelines|downloads|security|jira|deployments)(\/|$)/.test(
        path,
      );
    const accountPage =
      /\/(workspace|repositories|projects|snippets|stars|overview|activity)(\/|$)/.test(
        path,
      );
    if (!repoPage && !accountPage) return;
    const words = repoPage
      ? UX.NAV_WORDS.bitbucket || []
      : BITBUCKET_PROFILE_WORDS;
    const itemText = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    // Bitbucket's app mounts in the source's declared root; scoping the search
    // to it reads the declared hook and skips the page chrome outside it.
    const app = document.querySelector(UX.SELECTORS.bitbucket.app) || document;
    // The bar's items are a mix — a link, a button, a bare span — so the
    // selector is broad and `labelMatches` (whole-label only) keeps it precise.
    const items = [
      ...app.querySelectorAll(
        'a, button, [role="menuitem"], [role="tab"], [role="link"], span',
      ),
    ].filter((el) => words.some((word) => UX.labelMatches(itemText(el), word)));
    if (items.length < 2) return;

    // The bar is the ancestor that holds the most of these items.
    const counts = new Map();
    for (const el of items) {
      for (
        let parent = el.parentElement;
        parent && parent !== document.body;
        parent = parent.parentElement
      ) {
        counts.set(parent, (counts.get(parent) || 0) + 1);
      }
    }
    let nav = null;
    let best = 1;
    for (const [el, count] of counts) {
      if (count > best) {
        best = count;
        nav = el;
      }
    }
    if (!nav) return;

    // Mark it for the stylesheet, which sets the row/column for the layout.
    ledger(nav, 'bitbucket-nav', () => ({
      restore: () => nav.removeAttribute('data-gs-bb-nav'),
    }));
    nav.setAttribute('data-gs-bb-nav', '');

    // Relabel the items inside the bar, whole-label only, as the NAV pass does.
    const map = repoPage ? UX.NAV[t] || {} : BITBUCKET_PROFILE_MAP[t] || {};
    for (const el of items) {
      if (!nav.contains(el)) continue;
      for (const text of textNodes(el)) {
        const label = text.nodeValue.trim();
        const to = Object.keys(map).find((from) =>
          UX.labelMatches(label, from),
        );
        if (!to) continue;
        rememberText(text);
        const next = text.nodeValue.replace(label, map[to]);
        if (text.nodeValue !== next) text.nodeValue = next;
        break;
      }
    }

    // The Bitbucket repository bar carries the same categories the applied skin
    // groups (Repository, Merge requests, CI/CD, …), so group it like that
    // skin's own menu — the GitLab skin's Plan/Code/Build/Deploy headings. Only
    // where the skin groups, and only when the items share one parent to hang
    // the headings on.
    if (repoPage && UX.NAV_GROUPS[t]) {
      // Each item may sit in its own wrapper, so group at the level of the
      // bar's *direct children*: climb from each item to the child of `nav`
      // that holds it, and put the heading before that. The item's own label
      // is what the group is resolved from, not the wrapper's text.
      const rowOf = (el) => {
        let node = el;
        while (node.parentElement && node.parentElement !== nav) {
          node = node.parentElement;
        }
        return node.parentElement === nav ? node : null;
      };
      const entries = [];
      for (const el of items) {
        if (!nav.contains(el)) continue;
        const row = rowOf(el);
        if (row && !entries.some((entry) => entry.row === row)) {
          entries.push({
            row,
            label: (el.textContent || '').replace(/\s+/g, ' ').trim(),
          });
        }
      }
      if (entries.length >= 2) {
        ledger(nav, 'bitbucket-groups', () => ({
          restore: () =>
            nav
              .querySelectorAll(':scope > .gs-nav-group')
              .forEach((el) => el.remove()),
        }));
        for (const el of nav.querySelectorAll(':scope > .gs-nav-group')) {
          el.remove();
        }
        let last = null;
        for (const { row, label } of entries) {
          const group = UX.navGroupFor(label, t);
          if (group && group !== last) {
            const heading = document.createElement('span');
            heading.className = 'gs-nav-group';
            heading.setAttribute('data-gs-ux-skip', '');
            heading.textContent = group;
            nav.insertBefore(heading, row);
            last = group;
          }
        }
      }
    }
  }

  // PolyGerrit renders its chrome inside *open* shadow roots, so a content
  // script can reach it, but a document query cannot: `querySelector` stops at
  // the host element. This descends through the open roots to find one.
  function deepFirst(selector) {
    const walk = (scope) => {
      const hit = scope.querySelector(selector);
      if (hit) return hit;
      for (const el of scope.querySelectorAll('*')) {
        if (el.shadowRoot) {
          const found = walk(el.shadowRoot);
          if (found) return found;
        }
      }
      return null;
    };
    return walk(document);
  }

  // The styles the Gerrit passes inject into shadow roots. A `<style>` node
  // appended into the wrong root can render as visible text, so the rules are
  // adopted *constructed* stylesheets (not DOM nodes); they are tracked so a
  // theme change or revert removes them (a document query cannot reach a shadow
  // root). Each pass owns a ledger, so one pass re-running never clears the
  // other's sheets.
  function sheetLedger() {
    const sheets = []; // { root, sheet }
    return {
      clear() {
        for (const { root, sheet } of sheets) {
          if (root.adoptedStyleSheets) {
            root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
              (existing) => existing !== sheet,
            );
          }
        }
        sheets.length = 0;
      },
      adopt(root, css) {
        if (!root.adoptedStyleSheets || typeof CSSStyleSheet !== 'function') {
          return;
        }
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        sheets.push({ root, sheet });
      },
    };
  }
  const gerritNavSheets = sheetLedger();
  const gerritProfileSheets = sheetLedger();

  // Gerrit's own navigation words are not the applied product's. Its "Changes"
  // list is the review queue the target calls Pull/Merge requests, and "Browse"
  // opens the repository the target calls Code/Repository/Source. The page-wide
  // label pass cannot reach them (they live in the header's shadow root), so
  // they are relabelled here, where the shadow root is already open — and the
  // originals are remembered for revert. "Documentation" is the same word in
  // every product, so it is left alone.
  const GERRIT_NAV_WORDS = {
    github: { Changes: 'Pull requests', Browse: 'Code' },
    gitlab: { Changes: 'Merge requests', Browse: 'Repository' },
    bitbucket: { Changes: 'Pull requests', Browse: 'Source' },
  };

  // PolyGerrit renders its chrome inside *open* shadow roots, so a content
  // script can reach them, but a document stylesheet cannot: the injected CSS
  // never crosses the boundary. Reorient the header navigation to the applied
  // layout by injecting a small style into the shadow root that owns it — a row
  // for the GitHub layout, a column (sidebar) for the GitLab/Bitbucket layout,
  // where the header becomes a fixed left column with the content beside it.
  //
  // The GitHub layout keeps a top bar, so it additionally re-proportions the
  // bar to GitHub's app header (64px, GitHub's nav type) and flips the bar's
  // text token: the page-level `--primary-text-color` is the *page* colour
  // (dark), and it inherits into the bar's search field, which otherwise renders
  // dark-on-dark. The GitLab/Bitbucket layouts move the bar off-screen as a
  // sidebar, so they need neither.
  function paintGerritNav(t) {
    if (document.documentElement.dataset.gsSource !== 'gerrit') return;
    const nav = deepFirst('gr-main-header nav') || deepFirst('nav');
    if (!nav) return;
    const root = nav.getRootNode();
    if (!(root instanceof ShadowRoot)) return;

    const direction = t === 'github' ? 'row' : 'column';
    const relabelled = [];
    ledger(nav, 'gerrit-nav', () => ({
      restore: () => {
        for (const [el, text] of relabelled) el.textContent = text;
        nav.removeAttribute('data-gs-gerrit-nav');
        gerritNavSheets.clear();
      },
    }));
    gerritNavSheets.clear();

    // Mark the nav and target the marker: PolyGerrit does not always render the
    // nav inside `gr-main-header`, and a bare `nav` would hit its other navs.
    nav.setAttribute('data-gs-gerrit-nav', '');
    gerritNavSheets.adopt(
      root,
      `[data-gs-gerrit-nav]{display:flex !important;flex-direction:${direction} !important;}`,
    );

    // Relabel Gerrit's own nav words (Changes/Browse) to the applied product's.
    const words = GERRIT_NAV_WORDS[t];
    if (words) {
      for (const span of root.querySelectorAll('span.linksTitle')) {
        const current = (span.textContent || '').trim();
        if (!words[current]) continue;
        relabelled.push([span, span.textContent]);
        span.textContent = words[current];
      }
    }

    if (t === 'github') {
      gerritNavSheets.adopt(
        root,
        '[data-gs-gerrit-nav]{min-height:64px !important;align-items:center !important;' +
          'padding:0 16px !important;font-family:var(--gs-font) !important;' +
          '--primary-text-color:var(--gs-header-fg) !important;' +
          'color:var(--gs-header-fg) !important;}' +
          '[data-gs-gerrit-nav] a.bigTitle{font-size:20px !important;' +
          'font-weight:600 !important;letter-spacing:-.2px !important;}' +
          '[data-gs-gerrit-nav] ul.links{gap:8px !important;margin:0 0 0 12px !important;}' +
          '[data-gs-gerrit-nav] span.linksTitle{font-size:14px !important;' +
          'font-weight:600 !important;color:var(--gs-header-fg) !important;}' +
          '[data-gs-gerrit-nav] div.rightItems{gap:8px !important;margin-left:auto !important;}',
      );
      // The search field sits several shadow roots deep; find it from the header
      // and adopt the pill rules into the root that actually holds it — a rule
      // in an ancestor root cannot reach an input in a nested one.
      const walkInput = (scope, depth) => {
        if (depth > 8) return null;
        const hit = scope.querySelector('input');
        if (hit) return hit;
        for (const el of scope.querySelectorAll('*')) {
          if (el.shadowRoot) {
            const found = walkInput(el.shadowRoot, depth + 1);
            if (found) return found;
          }
        }
        return null;
      };
      const input = walkInput(root, 0);
      const inputRoot = input && input.getRootNode();
      if (inputRoot instanceof ShadowRoot) {
        gerritNavSheets.adopt(
          inputRoot,
          'input{background:transparent !important;color:var(--gs-header-fg) !important;' +
            'border:1px solid color-mix(in srgb, var(--gs-header-fg) 35%, transparent) !important;' +
            'border-radius:6px !important;height:32px !important;padding:0 8px !important;}' +
            'input::placeholder{color:var(--gs-header-fg) !important;opacity:.7 !important;}',
        );
      }
    }

    // A sidebar layout turns the header into a fixed left column with the main
    // content beside it — PolyGerrit's own shell is a full-width top bar, so the
    // sidebar is built from the same nodes. Only two roots need the rule: the
    // one holding `gr-main-header` and the one holding `main` (they can differ).
    if (direction === 'column') {
      const header = deepFirst('gr-main-header');
      const mainEl = deepFirst('main');
      const scopes = new Set([
        header ? header.getRootNode() : root,
        mainEl ? mainEl.getRootNode() : null,
      ]);
      const shellCss =
        'gr-main-header{position:fixed !important;inset:0 auto 0 0 !important;' +
        'width:260px !important;height:100vh !important;overflow:auto !important;}' +
        'main{margin-left:260px !important;}';
      for (const scope of scopes) {
        if (scope instanceof ShadowRoot) gerritNavSheets.adopt(scope, shellCss);
      }
    }
  }

  // Gerrit has no account profile route of its own. The closest thing it serves
  // is an owner query (`/q/owner:<account>`), which PolyGerrit heads with
  // `gr-user-header` — the account's avatar, display name, email and join date.
  // A project query (`/q/project:<project>`) is headed with `gr-repo-header` —
  // the project's name and its Detail/Browse links. The skins reshape either
  // header into the applied product's profile identity block and give it a
  // profile navigation built from Gerrit's own queries, so every tab is a real
  // Gerrit query rather than a dead link. The change list below stays Gerrit's.
  //
  // Read the subject from the URL using the marker the source declares
  // (`pages.<kind>.from`), so the route lives in the plugin rather than here.
  // An account id has no slash; a project path does.
  function gerritSubject(from, keepSlash) {
    const where = `${location.pathname}${location.hash}`;
    const at = where.indexOf(from);
    if (at === -1) return null;
    const rest = where.slice(at + from.length);
    const end = rest.search(keepSlash ? /[,+]/ : /[,+/]/);
    return end === -1 ? rest : rest.slice(0, end);
  }

  // A declared route is one shape or a list, and a shape is either a path or
  // `{ path, namespace }` (a project lives under a user *or* a group). The
  // profile tabs need the path only.
  function routePath(route) {
    const shape = Array.isArray(route) ? route[0] : route;
    return typeof shape === 'string' ? shape : (shape?.path ?? null);
  }

  // The profile navigation, built from Gerrit's own owner views on the route the
  // source declared (`pages.profile.route`), so every tab is a real query rather
  // than a dead link.
  const GERRIT_PROFILE_TABS = (route, subject) => [
    ['All', `${route}${subject}`],
    ['Open', `${route}${subject}+status:open`],
    ['Merged', `${route}${subject}+status:merged`],
    ['Abandoned', `${route}${subject}+status:abandoned`],
  ];

  // The applied skin's profile shape, adopted into the header's shadow root.
  // GitHub's profile is a large round avatar beside the identity, over a
  // horizontal tab row with an underlined current tab; GitLab's is the same
  // identity block with a subtle-background current item. A project header has
  // no avatar, so a monogram stands in. Everything is recoloured with the skin's
  // tokens so the card follows the palette.
  function gerritProfileCss(t) {
    const base =
      ':host{display:grid !important;grid-template-columns:96px 1fr !important;' +
      'grid-template-areas:"avatar info" "nav nav" !important;align-items:center !important;' +
      'column-gap:16px !important;background:transparent !important;border:0 !important;' +
      'border-bottom:1px solid var(--gs-border) !important;padding:24px 0 0 !important;' +
      'font-family:var(--gs-font) !important;color:var(--gs-fg) !important;}' +
      'gr-avatar,[data-gs-gerrit-profile-avatar]{grid-area:avatar !important;' +
      'width:96px !important;height:96px !important;margin:0 !important;' +
      'border-radius:50% !important;background-size:cover !important;' +
      'background-position:center !important;}' +
      '[data-gs-gerrit-profile-avatar]{display:flex !important;align-items:center !important;' +
      'justify-content:center !important;background:var(--gs-accent-subtle) !important;' +
      'color:var(--gs-accent) !important;font-size:40px !important;font-weight:600 !important;}' +
      '.info:first-of-type{grid-area:info !important;padding:0 !important;margin:0 !important;}' +
      '.info:not(:first-of-type){display:none !important;}' +
      'hr{display:none !important;}' +
      'h1.heading-1{font-size:24px !important;font-weight:600 !important;' +
      'line-height:1.25 !important;margin:0 0 4px !important;color:var(--gs-fg) !important;}' +
      '.info:first-of-type>div{color:var(--gs-fg-muted) !important;font-size:14px !important;' +
      'line-height:1.5 !important;margin:2px 0 !important;}' +
      '.info:first-of-type>div>span{color:var(--gs-fg-muted) !important;}' +
      '.info:first-of-type a{color:var(--gs-link) !important;}' +
      'nav[data-gs-gerrit-profile-nav]{grid-area:nav !important;display:flex !important;' +
      'gap:4px !important;margin-top:16px !important;}';
    const current =
      t === 'github'
        ? 'nav[data-gs-gerrit-profile-nav] a{padding:8px 12px !important;' +
          'font-size:14px !important;font-weight:500 !important;color:var(--gs-fg) !important;' +
          'text-decoration:none !important;border-bottom:2px solid transparent !important;}' +
          'nav[data-gs-gerrit-profile-nav] a[aria-current]{font-weight:600 !important;' +
          'border-bottom-color:var(--gs-accent) !important;}'
        : 'nav[data-gs-gerrit-profile-nav] a{padding:6px 12px !important;' +
          'font-size:14px !important;color:var(--gs-fg-muted) !important;' +
          'text-decoration:none !important;border-radius:var(--gs-radius-md) !important;}' +
          'nav[data-gs-gerrit-profile-nav] a[aria-current]{' +
          'background:var(--gs-accent-subtle) !important;color:var(--gs-accent) !important;' +
          'font-weight:600 !important;}';
    return base + current;
  }

  // The page kinds whose header wears the profile chrome, in the order they are
  // tried: the account's nearest page first, then the project's. `hook` names the
  // fallback selector in the source's `selectors` table.
  const GERRIT_PROFILE_KINDS = [
    { kind: 'profile', hook: 'userHeader', keepSlash: false },
    { kind: 'project', hook: 'repoHeader', keepSlash: true },
  ];

  function paintGerritSubjectHeader(t, { header, root, kind, route, subject }) {
    const signature = `${t}:${kind}:${subject}`;
    // Re-run when the applied skin changes, the subject changes, or PolyGerrit
    // has replaced the shadow root and dropped the navigation with it.
    if (
      header.getAttribute('data-gs-gerrit-profile') === signature &&
      root.querySelector('[data-gs-gerrit-profile-nav]')
    ) {
      return;
    }

    ledger(header, 'gerrit-profile', () => ({
      restore: () => {
        header.removeAttribute('data-gs-gerrit-profile');
        const made = header.shadowRoot
          ? header.shadowRoot.querySelectorAll(
              '[data-gs-gerrit-profile-nav],[data-gs-gerrit-profile-avatar]',
            )
          : [];
        for (const el of made) el.remove();
        gerritProfileSheets.clear();
      },
    }));

    // Drop the previous navigation, monogram and sheets before rebuilding; the
    // ledger entry reads the DOM at revert time, so it stays exact either way.
    gerritProfileSheets.clear();
    for (const el of root.querySelectorAll(
      '[data-gs-gerrit-profile-nav],[data-gs-gerrit-profile-avatar]',
    )) {
      el.remove();
    }
    header.setAttribute('data-gs-gerrit-profile', signature);

    // A project header has no image, so a monogram stands in — the same
    // convention GitHub uses for an organisation without a logo.
    if (!root.querySelector('gr-avatar')) {
      const name = (root.querySelector('h1')?.textContent || '').trim();
      const avatar = document.createElement('span');
      avatar.setAttribute('data-gs-gerrit-profile-avatar', '');
      avatar.setAttribute('data-gs-ux-skip', '');
      avatar.textContent = (name.match(/[a-z0-9]/i) || ['?'])[0].toUpperCase();
      root.insertBefore(avatar, root.firstChild);
    }

    const path = `${location.pathname}${location.hash}`;
    const nav = document.createElement('nav');
    nav.setAttribute('data-gs-gerrit-profile-nav', '');
    nav.setAttribute('data-gs-ux-skip', '');
    for (const [label, href] of GERRIT_PROFILE_TABS(route, subject)) {
      const anchor = document.createElement('a');
      anchor.textContent = label;
      anchor.setAttribute('href', href);
      const status = href.includes('status:')
        ? href.slice(href.indexOf('status:'))
        : null;
      const isCurrent = status ? path.includes(status) : !/status:/.test(path);
      if (isCurrent) anchor.setAttribute('aria-current', 'page');
      nav.appendChild(anchor);
    }
    root.appendChild(nav);
    gerritProfileSheets.adopt(root, gerritProfileCss(t));
  }

  // Reshape the header of whichever declared page kind this URL is, if any. A
  // page carries one header, so the first kind that matches wins.
  function paintGerritProfile(t) {
    if (document.documentElement.dataset.gsSource !== 'gerrit') return;
    const pages = UX.PAGES?.gerrit;
    if (!pages) return;
    for (const { kind, hook, keepSlash } of GERRIT_PROFILE_KINDS) {
      const page = pages[kind];
      if (!page || !page.from) continue;
      const route = routePath(page.route);
      // The DOM hook travels with the page declaration when the source carries
      // one, falling back to the source's `selectors` table.
      const selector = page.selectors?.header || SELECTORS.gerrit?.[hook];
      if (!route || !selector) continue;
      const header = deepFirst(selector);
      const root = header && header.shadowRoot;
      if (!root) continue;
      const subject = gerritSubject(page.from, keepSlash);
      if (!subject) continue;
      paintGerritSubjectHeader(t, { header, root, kind, route, subject });
      return;
    }
  }

  // PolyGerrit renders its chrome inside *open* shadow roots, so a content
  // script can reach them, but a document stylesheet cannot: the injected CSS
  // never crosses the boundary, and neither does the page-wide copy pass — it
  // walks `document.body` and stops at the host element. This pass visits every
  // open shadow root and runs the *shared* copy rules (`UX.controlLabel` /
  // `UX.translate`) over its text and attributes, so Gerrit's own strings read
  // as the applied product's. It skips the header navigation, which
  // `paintGerritNav` relabels with its own words, and records every change in
  // the ledger so a revert is exact.
  function paintGerritCopy(t) {
    if (document.documentElement.dataset.gsSource !== 'gerrit') return;
    const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];

    const roots = [];
    const collect = (scope, depth) => {
      if (depth > 8) return;
      for (const el of scope.querySelectorAll('*')) {
        if (!el.shadowRoot) continue;
        roots.push(el.shadowRoot);
        collect(el.shadowRoot, depth + 1);
      }
    };
    collect(document, 0);

    for (const root of roots) {
      for (const el of root.querySelectorAll('*')) {
        if (el.closest('[data-gs-gerrit-nav],[data-gs-gerrit-profile-nav]')) {
          continue;
        }
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const parent = node.parentElement;
          if (!parent || isSkipped(parent)) continue;
          const raw = node.nodeValue;
          if (!raw || !raw.trim()) continue;
          const control = parent.matches(UX.LABEL_SCOPE);
          const original = rememberText(node).trim();
          const value = control
            ? (UX.controlLabel(original, t) ?? UX.translate(raw, t))
            : UX.translate(raw, t);
          if (value !== raw) node.nodeValue = value;
        }
        for (const attr of ATTRS) {
          if (!el.hasAttribute(attr)) continue;
          const entry = ledger(el, 'gerrit-attrs', () => {
            const values = {};
            return {
              values,
              restore: () => {
                for (const name of Object.keys(values)) {
                  el.setAttribute(name, values[name]);
                }
              },
            };
          });
          if (!(attr in entry.values))
            entry.values[attr] = el.getAttribute(attr);
          const next = UX.translate(entry.values[attr], t);
          if (next !== el.getAttribute(attr)) el.setAttribute(attr, next);
        }
      }
    }
  }

  rt.once('project', () => {
    rt.globalPasses.push(
      paintGiteaNav,
      paintBitbucketNav,
      paintGerritNav,
      paintGerritProfile,
      paintGerritCopy,
      paintMetadata,
      paintAboutExtras,
      paintHeadings,
      paintProjectTabs,
      paintActiveTab,
    );
  });
})();
