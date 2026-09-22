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
    isSkipped,
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
      // GitLab serves Wiki and Security only when the project has them
      // enabled, so the source's own link is the authority; absent, the tab is
      // marked unavailable rather than pointing at a page that is not there.
      wiki: findHref(['Wiki']),
      security: findHref(['Security and quality', 'Security']),
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
    // The source product the tabs are built on, named in an "unavailable"
    // marker ("≠ GitLab"). A GitHub tab GitLab does not serve stays in the row
    // so the user is told, instead of a link that leads nowhere.
    const source = document.documentElement.dataset.gsSource || 'gitlab';
    const sourceName = UX.sourceProduct(source);
    for (const [label, href] of tabs) {
      const item = document.createElement('li');
      if (href) {
        const anchor = document.createElement('a');
        anchor.className = 'super-sidebar-nav-item';
        anchor.setAttribute('data-gs-project-tab', '');
        anchor.setAttribute('href', href);
        anchor.textContent = label;
        item.appendChild(anchor);
      } else {
        const note = document.createElement('span');
        note.className = 'super-sidebar-nav-item gs-project-tab-unavailable';
        note.setAttribute('data-gs-project-tab', '');
        note.setAttribute('data-gs-unavailable', sourceName);
        note.setAttribute('aria-disabled', 'true');
        note.title = `Not available on ${sourceName}`;
        note.textContent = label;
        const badge = document.createElement('span');
        badge.className = 'gs-no-equiv';
        badge.setAttribute('data-gs-ux-skip', '');
        badge.textContent = `≠ ${sourceName}`;
        note.appendChild(badge);
        item.appendChild(note);
      }
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
  const gerritViewSheets = sheetLedger();

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

  // The query this page runs, e.g. `project:plugins/oauth status:open`. The page
  // kind's route is not enough: the changes shown are the query's, and the
  // profile's content is built from them.
  function gerritQuery() {
    const where = `${location.pathname}${location.hash}`;
    const at = where.indexOf('/q/');
    if (at === -1) return null;
    const rest = where.slice(at + 3);
    const end = rest.search(/,/);
    return (end === -1 ? rest : rest.slice(0, end)).replace(/\+/g, ' ');
  }

  // The changes behind the query, from Gerrit's own REST API, and the project's
  // description when the query names one. Cached briefly so a re-render does not
  // refetch; the first miss kicks a fetch and repaints when it lands.
  const gerritCache = new Map();
  const gerritPending = new Set();
  const GERRIT_TTL = 60000;

  async function fetchGerrit(query, project) {
    const strip = (text) => (text.startsWith(")]}'") ? text.slice(4) : text);
    const get = async (url) =>
      JSON.parse(
        strip(
          await (
            await fetch(url, { headers: { Accept: 'application/json' } })
          ).text(),
        ),
      );
    const changes = await get(
      `/changes/?q=${encodeURIComponent(query)}&n=25&o=DETAILED_ACCOUNTS`,
    ).catch(() => []);
    const info = project
      ? await get(`/projects/${encodeURIComponent(project)}`).catch(() => ({}))
      : {};
    return {
      changes: Array.isArray(changes) ? changes : [],
      description: info.description || null,
      parent: info.parent || null,
      state: info.state || null,
      at: Date.now(),
    };
  }

  function repaintGerrit() {
    const cls = [...document.documentElement.classList].find((c) =>
      c.startsWith('gs-theme-'),
    );
    if (cls) paintGerritProfile(cls.slice('gs-theme-'.length));
  }

  function gerritData(query, project) {
    const cached = gerritCache.get(query);
    if (cached && Date.now() - cached.at < GERRIT_TTL) return cached;
    if (!gerritPending.has(query)) {
      gerritPending.add(query);
      fetchGerrit(query, project)
        .then((data) => {
          gerritCache.set(query, data);
          gerritPending.delete(query);
          repaintGerrit();
        })
        .catch(() => gerritPending.delete(query));
    }
    return cached || null;
  }

  // Gerrit timestamps are UTC without a zone and with nanoseconds.
  function gerritDate(value) {
    const m = String(value || '').match(
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
    );
    return m
      ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
      : null;
  }

  const escapeHtml = (value) =>
    String(value == null ? '' : value).replace(
      /[&<>"]/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
    );

  // What each product's profile page shows, and which part Gerrit can supply.
  // `source` names the Gerrit data that stands in; an entry without one has no
  // Gerrit equivalent and is marked, not faked — the profile analogue of the
  // source-feature markers in `themes/ux-markers.css`.
  const GERRIT_PROFILE_FURNITURE = {
    github: {
      tabs: [
        { label: 'Overview', source: 'changes' },
        { label: 'Repositories', source: 'repos' },
        { label: 'Projects' },
        { label: 'Packages' },
        { label: 'Stars' },
      ],
      rail: [
        { kind: 'handle' },
        { kind: 'bio' },
        { kind: 'follow' },
        { kind: 'stats' },
        { kind: 'achievements' },
        { kind: 'social' },
      ],
      sections: [
        {
          heading: 'Pinned',
          source: 'cards',
          note: 'Gerrit has no pinned repositories — showing recent changes',
        },
        { heading: 'Activity', source: 'graph' },
      ],
    },
    gitlab: {
      tabs: [
        { label: 'Activity', source: 'changes' },
        { label: 'Groups' },
        { label: 'Contributed projects' },
        { label: 'Personal projects' },
        { label: 'Starred projects' },
        { label: 'Snippets' },
        { label: 'Followers' },
        { label: 'Following' },
      ],
      rail: [
        { kind: 'handle' },
        { kind: 'bio' },
        { kind: 'follow' },
        { kind: 'stats' },
        { kind: 'achievements' },
        { kind: 'social' },
      ],
      sections: [
        { heading: 'Activity', source: 'graph' },
        { heading: 'Personal projects' },
      ],
    },
    bitbucket: {
      tabs: [
        { label: 'Overview', source: 'changes' },
        { label: 'Repositories', source: 'repos' },
        { label: 'Projects' },
        { label: 'Snippets' },
      ],
      rail: [
        { kind: 'handle' },
        { kind: 'bio' },
        { kind: 'follow' },
        { kind: 'stats' },
        { kind: 'social' },
      ],
      sections: [
        {
          heading: 'Repositories',
          source: 'cards',
          note: 'Gerrit has no pinned repositories — showing recent changes',
        },
        { heading: 'Activity', source: 'graph' },
      ],
    },
  };

  // The pale "no equivalent" marker: a `≠` pill on the element, and a dashed box
  // for a whole missing block.
  function noEquiv(note) {
    const pill = document.createElement('span');
    pill.className = 'gs-gerrit-noeq';
    pill.setAttribute('data-gs-ux-skip', '');
    pill.textContent = '\u2260';
    if (note) pill.title = note;
    return pill;
  }

  function markNoEquiv(el, note) {
    el.classList.add('gs-gerrit-missing');
    el.setAttribute('aria-disabled', 'true');
    if (note) el.title = note;
    el.appendChild(noEquiv(note));
    return el;
  }

  function missingBox(text) {
    const box = document.createElement('div');
    box.className = 'gs-gerrit-missbox';
    box.setAttribute('data-gs-ux-skip', '');
    box.textContent = text;
    return box;
  }

  // The rail (the header restyled): a large avatar over the identity, with the
  // product's extra blocks appended after the name.
  function gerritRailCss() {
    return (
      ':host{display:block !important;background:transparent !important;border:0 !important;' +
      'padding:0 !important;font-family:var(--gs-font) !important;color:var(--gs-fg) !important;}' +
      'gr-avatar,[data-gs-gerrit-profile-avatar]{display:block !important;width:100% !important;' +
      'aspect-ratio:1/1 !important;border-radius:50% !important;background-size:cover !important;' +
      'background-position:center !important;margin:0 0 16px !important;}' +
      '[data-gs-gerrit-profile-avatar]{display:flex !important;align-items:center !important;' +
      'justify-content:center !important;background:var(--gs-accent-subtle) !important;' +
      'color:var(--gs-accent) !important;font-size:96px !important;font-weight:600 !important;}' +
      'h1.heading-1{font-size:24px !important;font-weight:600 !important;' +
      'line-height:1.25 !important;margin:0 0 4px !important;color:var(--gs-fg) !important;}' +
      '.gs-gerrit-name{font-size:24px !important;font-weight:600 !important;' +
      'line-height:1.25 !important;margin:0 0 4px !important;color:var(--gs-fg) !important;}' +
      'hr{display:none !important;}' +
      '.info:first-of-type{padding:0 !important;margin:0 !important;}' +
      '.info:not(:first-of-type){display:none !important;}' +
      '.info:first-of-type>div{color:var(--gs-fg-muted) !important;font-size:14px !important;' +
      'line-height:1.5 !important;margin:2px 0 !important;}' +
      '.info:first-of-type>div>span{color:var(--gs-fg-muted) !important;}' +
      '.info:first-of-type a{color:var(--gs-link) !important;}' +
      '.gs-gerrit-handle{font-size:20px !important;font-weight:300 !important;' +
      'color:var(--gs-attention) !important;margin:0 0 16px !important;}' +
      '.gs-gerrit-follow{display:block !important;width:100% !important;box-sizing:border-box !important;' +
      'text-align:center !important;padding:5px 16px !important;font-size:14px !important;' +
      'font-weight:600 !important;background:var(--gs-attention-subtle) !important;' +
      'border:1px solid var(--gs-attention) !important;border-radius:6px !important;' +
      'margin:0 0 16px !important;color:var(--gs-attention) !important;cursor:not-allowed !important;' +
      'pointer-events:none !important;font-family:var(--gs-font) !important;}' +
      '.gs-gerrit-stats{display:flex !important;gap:16px !important;font-size:14px !important;' +
      'color:var(--gs-fg-muted) !important;margin:0 0 16px !important;}' +
      '.gs-gerrit-stats b{color:var(--gs-fg) !important;}' +
      '.gs-gerrit-bio{font-size:14px !important;color:var(--gs-fg) !important;margin:0 0 12px !important;}' +
      '.gs-gerrit-misshead{font-size:16px !important;font-weight:600 !important;' +
      'color:var(--gs-attention) !important;margin:20px 0 8px !important;}' +
      '.gs-gerrit-missbox{border:1px dashed var(--gs-attention) !important;' +
      'background:var(--gs-attention-subtle) !important;color:var(--gs-attention) !important;' +
      'border-radius:6px !important;padding:10px 12px !important;font-size:13px !important;' +
      'margin:4px 0 !important;}' +
      '.gs-gerrit-noeq{display:inline-block !important;margin-left:6px !important;' +
      'padding:0 5px !important;font-size:10px !important;font-weight:600 !important;' +
      'line-height:15px !important;border:1px solid currentColor !important;' +
      'border-radius:999px !important;vertical-align:middle !important;' +
      'color:var(--gs-attention) !important;}' +
      '.gs-gerrit-missing{color:var(--gs-attention) !important;' +
      'background:var(--gs-attention-subtle) !important;border-radius:6px !important;' +
      'cursor:not-allowed !important;pointer-events:none !important;text-decoration:none !important;}'
    );
  }

  // The content column: the product's profile tabs and sections, laid out beside
  // the rail on a two-column grid.
  function gerritViewCss(t) {
    const tabs =
      t === 'github'
        ? 'a{padding:8px 12px !important;font-size:14px !important;font-weight:500 !important;' +
          'color:var(--gs-fg) !important;text-decoration:none !important;' +
          'border-bottom:2px solid transparent !important;}' +
          'a[aria-current]{font-weight:600 !important;border-bottom-color:var(--gs-accent) !important;}'
        : 'a{padding:6px 12px !important;font-size:14px !important;' +
          'color:var(--gs-fg-muted) !important;text-decoration:none !important;' +
          'border-radius:var(--gs-radius-md) !important;}' +
          'a[aria-current]{background:var(--gs-accent-subtle) !important;' +
          'color:var(--gs-accent) !important;font-weight:600 !important;}';
    return (
      '[data-gs-gerrit-view]{display:grid !important;' +
      'grid-template-columns:296px minmax(0,1fr) !important;' +
      'grid-template-areas:"rail content" !important;column-gap:32px !important;' +
      'align-items:start !important;padding:0 32px !important;max-width:1280px !important;' +
      'margin:0 auto !important;box-sizing:border-box !important;}' +
      '[data-gs-gerrit-view]>gr-repo-header,[data-gs-gerrit-view]>gr-user-header{' +
      'grid-area:rail !important;}' +
      '[data-gs-gerrit-view]>[data-gs-gerrit-content]{grid-area:content !important;' +
      'min-width:0 !important;}' +
      '[data-gs-gerrit-view]>gr-change-list,' +
      '[data-gs-gerrit-view]>nav:not([data-gs-gerrit-profile-nav]){display:none !important;}' +
      '[data-gs-gerrit-content]>nav[data-gs-gerrit-profile-nav]{display:flex !important;' +
      'flex-wrap:wrap !important;gap:4px !important;' +
      'border-bottom:1px solid var(--gs-border) !important;margin:0 0 24px !important;}' +
      `[data-gs-gerrit-content]>nav[data-gs-gerrit-profile-nav] ${tabs}` +
      '.gs-gerrit-tab{display:inline-flex !important;align-items:center !important;}' +
      '.gs-gerrit-count{background:var(--gs-canvas-subtle) !important;' +
      'border-radius:20px !important;padding:0 6px !important;font-size:12px !important;' +
      'color:var(--gs-fg) !important;margin-left:8px !important;}' +
      '.gs-gerrit-h2{font-size:16px !important;font-weight:600 !important;' +
      'margin:0 0 8px !important;color:var(--gs-fg) !important;}' +
      '.gs-gerrit-h2.gs-gerrit-missing{background:transparent !important;}' +
      '.gs-gerrit-cards{display:grid !important;grid-template-columns:1fr 1fr !important;' +
      'gap:16px !important;margin:0 0 32px !important;}' +
      '.gs-gerrit-card{border:1px solid var(--gs-border) !important;border-radius:6px !important;' +
      'padding:16px !important;min-width:0 !important;}' +
      '.gs-gerrit-card .name{display:flex !important;align-items:center !important;' +
      'gap:8px !important;font-weight:600 !important;font-size:14px !important;min-width:0 !important;}' +
      '.gs-gerrit-card .name a{color:var(--gs-link) !important;text-decoration:none !important;' +
      'overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;}' +
      '.gs-gerrit-pill{border:1px solid var(--gs-border) !important;border-radius:20px !important;' +
      'padding:0 7px !important;font-size:12px !important;color:var(--gs-fg-muted) !important;' +
      'font-weight:500 !important;flex:none !important;}' +
      '.gs-gerrit-card .desc{font-size:12px !important;color:var(--gs-fg-muted) !important;' +
      'margin:8px 0 !important;overflow:hidden !important;text-overflow:ellipsis !important;' +
      'white-space:nowrap !important;}' +
      '.gs-gerrit-card .foot{display:flex !important;gap:16px !important;font-size:12px !important;' +
      'color:var(--gs-fg-muted) !important;}' +
      '.gs-gerrit-graph{display:grid !important;grid-auto-flow:column !important;' +
      'grid-template-rows:repeat(7,11px) !important;gap:3px !important;margin:0 0 32px !important;}' +
      '.gs-gerrit-graph span{width:11px !important;height:11px !important;border-radius:2px !important;}' +
      '.gs-gerrit-changes{display:flex !important;flex-direction:column !important;}' +
      '.gs-gerrit-change{display:flex !important;justify-content:space-between !important;' +
      'gap:16px !important;padding:8px 0 !important;' +
      'border-bottom:1px solid var(--gs-border) !important;font-size:14px !important;}' +
      '.gs-gerrit-change a{color:var(--gs-link) !important;text-decoration:none !important;' +
      'overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;}' +
      '.gs-gerrit-change span{color:var(--gs-fg-muted) !important;flex:none !important;}' +
      '.gs-gerrit-missbox{border:1px dashed var(--gs-attention) !important;' +
      'background:var(--gs-attention-subtle) !important;color:var(--gs-attention) !important;' +
      'border-radius:6px !important;padding:10px 12px !important;font-size:13px !important;' +
      'margin:0 0 24px !important;}' +
      '.gs-gerrit-noeq{display:inline-block !important;margin-left:6px !important;' +
      'padding:0 5px !important;font-size:10px !important;font-weight:600 !important;' +
      'line-height:15px !important;border:1px solid currentColor !important;' +
      'border-radius:999px !important;vertical-align:middle !important;' +
      'color:var(--gs-attention) !important;}' +
      '.gs-gerrit-missing{color:var(--gs-attention) !important;' +
      'background:var(--gs-attention-subtle) !important;border-radius:6px !important;' +
      'cursor:not-allowed !important;pointer-events:none !important;text-decoration:none !important;}'
    );
  }

  // The page kinds whose header wears the profile chrome, in the order they are
  // tried: the account's nearest page first, then the project's. `hook` names the
  // fallback selector in the source's `selectors` table.
  const GERRIT_PROFILE_KINDS = [
    { kind: 'profile', hook: 'userHeader', keepSlash: false },
    { kind: 'project', hook: 'repoHeader', keepSlash: true },
  ];

  // ---- a project query wears the product's *repository* page ----
  //
  // A project query is a repository, so it gets the repo page — the owner/repo
  // header, its tabs, and on the Code tab the file tree. The tree comes from the
  // Gitiles browser the repo header links to; Gitiles is often a *different
  // origin*, which the page cannot read, so the fetch is attempted only when it
  // shares this origin. Otherwise the Code tab links out to the real browser
  // rather than inventing a file list.
  const GERRIT_REPO_FURNITURE = {
    github: {
      actions: ['Watch', 'Fork', 'Star'],
      tabs: [
        { label: 'Code', source: 'files', current: true },
        { label: 'Issues' },
        { label: 'Pull requests', source: 'changes' },
        { label: 'Actions' },
        { label: 'Projects' },
        { label: 'Wiki' },
        { label: 'Security' },
        { label: 'Insights' },
      ],
    },
    gitlab: {
      actions: ['Star', 'Fork'],
      tabs: [
        { label: 'Repository', source: 'files', current: true },
        { label: 'Issues' },
        { label: 'Merge requests', source: 'changes' },
        { label: 'CI/CD' },
        { label: 'Deployments' },
        { label: 'Packages' },
        { label: 'Analytics' },
        { label: 'Wiki' },
      ],
    },
    bitbucket: {
      actions: ['Watch', 'Fork'],
      tabs: [
        { label: 'Source', source: 'files', current: true },
        { label: 'Commits' },
        { label: 'Branches' },
        { label: 'Pull requests', source: 'changes' },
        { label: 'Pipelines' },
        { label: 'Deployments' },
        { label: 'Downloads' },
      ],
    },
  };

  const GERRIT_NOEQ = '<span class="gs-gerrit-noeq">\u2260</span>';

  // The Gitiles browser the repo header links to, if it links to one.
  function gerritBrowseUrl(root) {
    const weblink = root.querySelector('gr-weblink');
    const anchor =
      weblink && (weblink.shadowRoot || weblink).querySelector('a[href]');
    return anchor ? anchor.getAttribute('href') : null;
  }

  // The file tree behind a Gitiles browse URL, fetched only when it shares this
  // origin. Cached; a miss fetches and repaints. `null` means "not available —
  // link out".
  const gerritTrees = new Map();
  const gerritTreesPending = new Set();

  async function fetchGerritTree(browseUrl, branch) {
    const url = `${browseUrl.replace(/\/$/, '')}/+/refs/heads/${branch}/?format=JSON`;
    const text = await (
      await fetch(url, { headers: { Accept: 'application/json' } })
    ).text();
    const json = JSON.parse(text.startsWith(")]}'") ? text.slice(4) : text);
    return Array.isArray(json.entries) ? json.entries : [];
  }

  function gerritTree(browseUrl, branch) {
    if (!browseUrl) return null;
    let sameOrigin = false;
    try {
      sameOrigin = new URL(browseUrl, location.href).origin === location.origin;
    } catch {
      sameOrigin = false;
    }
    if (!sameOrigin) return null;
    const key = `${browseUrl}#${branch}`;
    if (gerritTrees.has(key)) return gerritTrees.get(key);
    if (!gerritTreesPending.has(key)) {
      gerritTreesPending.add(key);
      fetchGerritTree(browseUrl, branch)
        .then((entries) => {
          gerritTrees.set(key, entries);
          gerritTreesPending.delete(key);
          repaintGerrit();
        })
        .catch(() => {
          gerritTrees.set(key, []);
          gerritTreesPending.delete(key);
          repaintGerrit();
        });
    }
    return null;
  }

  // The repository's branch and tag counts, and the clone schemes the server
  // advertises (`/config/server/info`), all from Gerrit's REST API on this
  // origin. Cached; a miss fetches and repaints.
  const gerritRepoInfo = new Map();
  const gerritRepoInfoPending = new Set();

  async function fetchGerritRepoInfo(project) {
    const strip = (text) => (text.startsWith(")]}'") ? text.slice(4) : text);
    const get = async (url) =>
      JSON.parse(
        strip(
          await (
            await fetch(url, { headers: { Accept: 'application/json' } })
          ).text(),
        ),
      );
    const base = `/projects/${encodeURIComponent(project)}`;
    const branches = await get(`${base}/branches`).catch(() => []);
    const tags = await get(`${base}/tags`).catch(() => []);
    const info = await get('/config/server/info').catch(() => ({}));
    return {
      branches: Array.isArray(branches) ? branches.length : 0,
      tags: Array.isArray(tags) ? tags.length : 0,
      download: info.download || null,
    };
  }

  function gerritRepoData(project) {
    const cached = gerritRepoInfo.get(project);
    if (cached) return cached;
    if (!gerritRepoInfoPending.has(project)) {
      gerritRepoInfoPending.add(project);
      fetchGerritRepoInfo(project)
        .then((info) => {
          gerritRepoInfo.set(project, info);
          gerritRepoInfoPending.delete(project);
          repaintGerrit();
        })
        .catch(() => gerritRepoInfoPending.delete(project));
    }
    return cached || null;
  }

  function cloneUrl(template, project) {
    return String(template || '')
      .replace(/\$\{project\}/g, project)
      .replace(/\$\{project-base-name\}/g, project.split('/').pop());
  }

  function gerritRepoCss(t) {
    const accent = t === 'github' ? '#fd8c73' : 'var(--gs-accent)';
    return (
      '[data-gs-gerrit-hidden]{display:none !important;}' +
      '[data-gs-gerrit-repo]{display:block !important;padding:0 32px !important;' +
      'max-width:1280px !important;margin:0 auto !important;box-sizing:border-box !important;' +
      'font-family:var(--gs-font) !important;color:var(--gs-fg) !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-head{display:flex !important;align-items:center !important;' +
      'justify-content:space-between !important;gap:16px !important;padding:16px 0 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-title{font-size:20px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-title a{text-decoration:none !important;' +
      'color:var(--gs-link) !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-title .repo{font-weight:600 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-pill{border:1px solid var(--gs-border) !important;' +
      'border-radius:20px !important;padding:0 7px !important;font-size:12px !important;' +
      'color:var(--gs-fg-muted) !important;margin-left:8px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-actions{display:flex !important;gap:8px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-actions button{font-size:12px !important;' +
      'font-weight:600 !important;padding:4px 12px !important;' +
      'border:1px solid var(--gs-attention) !important;border-radius:6px !important;' +
      'background:var(--gs-attention-subtle) !important;color:var(--gs-attention) !important;' +
      'font-family:var(--gs-font) !important;cursor:not-allowed !important;' +
      'pointer-events:none !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-tabs{display:flex !important;flex-wrap:wrap !important;' +
      'gap:4px !important;border-bottom:1px solid var(--gs-border) !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-tabs a,' +
      '[data-gs-gerrit-repo] .gs-repo-tabs span.tab{display:flex !important;' +
      'align-items:center !important;gap:8px !important;padding:8px 12px !important;' +
      'font-size:14px !important;color:var(--gs-fg) !important;text-decoration:none !important;' +
      'border-bottom:2px solid transparent !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-tabs a[aria-current]{font-weight:600 !important;' +
      `border-bottom-color:${accent} !important;}` +
      '[data-gs-gerrit-repo] .gs-repo-tabs .count{background:var(--gs-canvas-subtle) !important;' +
      'border-radius:20px !important;padding:0 6px !important;font-size:12px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-bar{display:flex !important;align-items:center !important;' +
      'gap:12px !important;padding:12px 0 !important;font-size:14px !important;' +
      'color:var(--gs-fg-muted) !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-branch{border:1px solid var(--gs-border) !important;' +
      'border-radius:6px !important;padding:3px 10px !important;color:var(--gs-fg) !important;' +
      'font-weight:600 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-bar a{color:var(--gs-link) !important;' +
      'text-decoration:none !important;font-size:13px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-code{margin-left:auto !important;' +
      'background:var(--gs-success) !important;color:#fff !important;border:0 !important;' +
      'border-radius:6px !important;padding:5px 14px !important;font-size:14px !important;' +
      'font-weight:600 !important;font-family:var(--gs-font) !important;cursor:pointer !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-code .caret{font-size:10px !important;' +
      'margin-left:6px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-clone{border:1px solid var(--gs-border) !important;' +
      'border-radius:6px !important;margin:8px 0 16px !important;padding:12px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-clone-row{display:flex !important;' +
      'align-items:center !important;gap:12px !important;padding:6px 0 !important;' +
      'font-size:13px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-clone-row b{min-width:120px !important;' +
      'font-weight:600 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-clone-row code{font-family:var(--gs-font-mono) !important;' +
      'background:var(--gs-canvas-subtle) !important;padding:3px 8px !important;' +
      'border-radius:6px !important;overflow:hidden !important;' +
      'text-overflow:ellipsis !important;white-space:nowrap !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-clone-row.gs-gerrit-missing{' +
      'background:var(--gs-attention-subtle) !important;border-radius:6px !important;' +
      'padding:6px 8px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-body{display:grid !important;' +
      'grid-template-columns:minmax(0,1fr) 296px !important;gap:32px !important;' +
      'align-items:start !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-side{display:flex !important;' +
      'flex-direction:column !important;gap:20px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-about{border-bottom:1px solid var(--gs-border) !important;' +
      'padding-bottom:16px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-about h2{font-size:16px !important;' +
      'font-weight:600 !important;margin:0 0 8px !important;color:var(--gs-fg) !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-about p{font-size:14px !important;' +
      'color:var(--gs-fg) !important;margin:0 0 12px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-about-row{display:flex !important;' +
      'align-items:center !important;gap:6px !important;font-size:12px !important;' +
      'color:var(--gs-fg-muted) !important;padding:2px 0 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-about-row b{color:var(--gs-fg) !important;' +
      'font-weight:600 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-about-row a{color:var(--gs-link) !important;' +
      'text-decoration:none !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-about-row.gs-gerrit-missing{' +
      'background:var(--gs-attention-subtle) !important;color:var(--gs-attention) !important;' +
      'border-radius:6px !important;padding:3px 8px !important;margin:2px 0 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-contribs{display:flex !important;' +
      'flex-wrap:wrap !important;gap:8px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-contrib{font-size:12px !important;' +
      'color:var(--gs-fg) !important;background:var(--gs-canvas-subtle) !important;' +
      'border-radius:20px !important;padding:2px 10px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-file{display:flex !important;align-items:center !important;' +
      'padding:8px 0 !important;border-top:1px solid var(--gs-border) !important;' +
      'font-size:14px !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-file a{color:var(--gs-link) !important;' +
      'text-decoration:none !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-note{border:1px dashed var(--gs-attention) !important;' +
      'background:var(--gs-attention-subtle) !important;color:var(--gs-attention) !important;' +
      'border-radius:6px !important;padding:12px !important;font-size:13px !important;' +
      'margin:12px 0 !important;}' +
      '[data-gs-gerrit-repo] .gs-repo-note a{color:inherit !important;font-weight:600 !important;}' +
      '[data-gs-gerrit-repo] .gs-gerrit-noeq{display:inline-block !important;' +
      'margin-left:6px !important;padding:0 5px !important;font-size:10px !important;' +
      'font-weight:600 !important;line-height:15px !important;' +
      'border:1px solid currentColor !important;border-radius:999px !important;' +
      'vertical-align:middle !important;color:var(--gs-attention) !important;}' +
      '[data-gs-gerrit-repo] .gs-gerrit-missing{color:var(--gs-attention) !important;' +
      'background:var(--gs-attention-subtle) !important;border-radius:6px !important;' +
      'cursor:not-allowed !important;pointer-events:none !important;' +
      'text-decoration:none !important;}'
    );
  }

  function paintGerritRepoPage(
    t,
    { root, viewRoot, wrapper, subject, data, repoInfo },
  ) {
    const furniture = GERRIT_REPO_FURNITURE[t];
    if (!furniture || !(viewRoot instanceof ShadowRoot)) return;
    const changes = data ? data.changes : [];
    const [owner, ...rest] = subject.split('/');
    const repo = rest.join('/') || owner;
    const branch = (changes.find((c) => c.branch) || {}).branch || 'master';
    const browseUrl = gerritBrowseUrl(root);
    const tree = gerritTree(browseUrl, branch);
    const home = browseUrl || `/q/project:${subject}`;

    const box = document.createElement('div');
    box.setAttribute('data-gs-gerrit-repo', '');
    box.setAttribute('data-gs-ux-skip', '');

    const actions = furniture.actions
      .map(
        (label) =>
          `<button disabled>${escapeHtml(label)}` +
          `<span class="gs-gerrit-noeq" title="Gerrit has no ${escapeHtml(
            label.toLowerCase(),
          )}">\u2260</span></button>`,
      )
      .join('');

    const tabs = furniture.tabs
      .map((tab) => {
        if (tab.source) {
          const count = tab.source === 'changes' ? changes.length : '';
          return (
            `<a href="/q/project:${escapeHtml(subject)}"` +
            (tab.current ? ' aria-current="page"' : '') +
            `><span>${escapeHtml(tab.label)}</span>` +
            (count ? `<span class="count">${count}</span>` : '') +
            `</a>`
          );
        }
        return (
          `<span class="tab gs-gerrit-missing" aria-disabled="true" ` +
          `title="No equivalent on Gerrit"><span>${escapeHtml(
            tab.label,
          )}</span>${GERRIT_NOEQ}</span>`
        );
      })
      .join('');

    let files;
    if (tree && tree.length) {
      const sorted = tree
        .slice()
        .sort((a, b) =>
          a.type === b.type
            ? a.name.localeCompare(b.name)
            : a.type === 'tree'
              ? -1
              : 1,
        );
      files = sorted
        .map((entry) => {
          const dir = entry.type === 'tree';
          const href =
            `${(browseUrl || '').replace(/\/$/, '')}/+/refs/heads/${branch}/` +
            `${entry.name}${dir ? '/' : ''}`;
          return (
            `<div class="gs-repo-file"><a href="${escapeHtml(
              href,
            )}" target="_blank" rel="noopener">${escapeHtml(entry.name)}` +
            `${dir ? '/' : ''}</a></div>`
          );
        })
        .join('');
    } else {
      files =
        `<div class="gs-repo-note">The file tree lives in Gitiles` +
        (browseUrl ? '' : ' (not linked on this instance)') +
        `. <a href="${escapeHtml(home)}" target="_blank" rel="noopener">` +
        `Open the file browser</a></div>`;
    }

    // Branch/tag counts and the clone schemes the server advertises.
    const schemes =
      (repoInfo && repoInfo.download && repoInfo.download.schemes) || {};
    const archives =
      (repoInfo && repoInfo.download && repoInfo.download.archives) || [];
    const cloneRow = (label, value) =>
      `<div class="gs-repo-clone-row${value ? '' : ' gs-gerrit-missing'}">` +
      `<b>${escapeHtml(label)}</b>` +
      (value ? `<code>${escapeHtml(value)}</code>` : GERRIT_NOEQ) +
      `</div>`;
    const cloneRows = [];
    if (schemes.http) {
      cloneRows.push(cloneRow('HTTPS', cloneUrl(schemes.http.url, subject)));
    }
    if (schemes.ssh) {
      cloneRows.push(cloneRow('SSH', cloneUrl(schemes.ssh.url, subject)));
    } else {
      cloneRows.push(cloneRow('SSH', null));
    }
    cloneRows.push(cloneRow('Gerrit CLI', null));
    if (archives.length) {
      for (const archive of archives) {
        cloneRows.push(
          cloneRow(
            `Download ${archive.format || 'archive'}`,
            archive.url || '',
          ),
        );
      }
    } else {
      cloneRows.push(cloneRow('Download ZIP', null));
    }
    const counts = repoInfo
      ? `<a href="/q/project:${escapeHtml(subject)}">${repoInfo.branches} ` +
        `${repoInfo.branches === 1 ? 'branch' : 'branches'}</a>` +
        `<a href="/q/project:${escapeHtml(subject)}">${repoInfo.tags} ` +
        `${repoInfo.tags === 1 ? 'tag' : 'tags'}</a>`
      : '';

    // The right-hand About sidebar: the real project metadata Gerrit exposes,
    // plus the sections GitHub shows that Gerrit has no equivalent for, marked.
    const contributors = [
      ...new Set(changes.map((c) => c.owner && c.owner.name).filter(Boolean)),
    ];
    const missingRow = (label) =>
      `<div class="gs-repo-about-row gs-gerrit-missing">${escapeHtml(
        label,
      )}${GERRIT_NOEQ}</div>`;
    const aboutRows =
      (data && data.parent
        ? `<div class="gs-repo-about-row">Parent <b>${escapeHtml(
            data.parent,
          )}</b></div>`
        : '') +
      (data && data.state
        ? `<div class="gs-repo-about-row">State <b>${escapeHtml(
            data.state,
          )}</b></div>`
        : '') +
      (browseUrl
        ? `<div class="gs-repo-about-row">Browse <a href="${escapeHtml(
            browseUrl,
          )}" target="_blank" rel="noopener">Gitiles</a></div>`
        : '') +
      ['Readme', 'License', 'Stars', 'Watchers', 'Forks']
        .map(missingRow)
        .join('');
    const contributorsHtml = contributors.length
      ? contributors
          .map(
            (name) =>
              `<span class="gs-repo-contrib">${escapeHtml(name)}</span>`,
          )
          .join('')
      : missingRow('Contributors');
    const side =
      `<aside class="gs-repo-side">` +
      `<div class="gs-repo-about"><h2>About</h2>` +
      (data && data.description
        ? `<p>${escapeHtml(data.description)}</p>`
        : '') +
      aboutRows +
      `</div>` +
      `<div class="gs-repo-about"><h2>Contributors</h2>` +
      `<div class="gs-repo-contribs">${contributorsHtml}</div></div>` +
      `<div class="gs-repo-about"><h2>Releases${GERRIT_NOEQ}</h2>` +
      `<div class="gs-repo-about-row gs-gerrit-missing">Gerrit has tags, not ` +
      `releases${GERRIT_NOEQ}</div></div>` +
      `<div class="gs-repo-about"><h2>Packages${GERRIT_NOEQ}</h2></div>` +
      `<div class="gs-repo-about"><h2>Languages${GERRIT_NOEQ}</h2></div>` +
      `</aside>`;

    box.innerHTML =
      `<div class="gs-repo-head"><div class="gs-repo-title">` +
      `<a href="${escapeHtml(home)}" target="_blank" rel="noopener">${escapeHtml(
        owner,
      )}</a> / ` +
      `<a class="repo" href="${escapeHtml(
        home,
      )}" target="_blank" rel="noopener">${escapeHtml(repo)}</a>` +
      `<span class="gs-repo-pill">Public</span></div>` +
      `<div class="gs-repo-actions">${actions}</div></div>` +
      `<nav class="gs-repo-tabs">${tabs}</nav>` +
      `<div class="gs-repo-body"><div class="gs-repo-main">` +
      `<div class="gs-repo-bar"><span class="gs-repo-branch">${escapeHtml(
        branch,
      )}</span>` +
      counts +
      `<span>${changes.length} open ${
        changes.length === 1 ? 'change' : 'changes'
      }</span>` +
      `<button type="button" class="gs-repo-code" aria-expanded="false">Code` +
      `<span class="caret">\u25be</span></button></div>` +
      `<div class="gs-repo-clone" hidden>${cloneRows.join('')}</div>` +
      files +
      `</div>` +
      side +
      `</div>`;

    const codeButton = box.querySelector('.gs-repo-code');
    const clone = box.querySelector('.gs-repo-clone');
    if (codeButton && clone) {
      codeButton.addEventListener('click', () => {
        clone.hidden = !clone.hidden;
        codeButton.setAttribute('aria-expanded', String(!clone.hidden));
      });
    }

    if (wrapper) wrapper.setAttribute('data-gs-gerrit-hidden', '');
    viewRoot.appendChild(box);
    gerritViewSheets.adopt(viewRoot, gerritRepoCss(t));
  }

  function paintGerritSubjectHeader(t, { header, root, kind, route, subject }) {
    const furniture = GERRIT_PROFILE_FURNITURE[t];
    if (!furniture) return;
    // The wrapper that holds the header, the change list and the pagination lives
    // in the *view's* shadow root, which is the tree the header sits in.
    const viewRoot = header.getRootNode();
    const wrapper =
      viewRoot instanceof ShadowRoot
        ? [...viewRoot.children].find(
            (c) => c.tagName === 'DIV' && c.className !== 'loading',
          )
        : null;
    const query = gerritQuery();
    const data = query
      ? gerritData(query, kind === 'project' ? subject : null)
      : null;
    // A project query also needs the repo's branch/tag counts and clone schemes;
    // they arrive asynchronously, so they are part of the signature too.
    const repoInfo = kind === 'project' ? gerritRepoData(subject) : null;
    const signature =
      `${t}:${kind}:${subject}:${data ? 'data' : 'base'}` +
      `:${repoInfo ? 'info' : ''}`;

    // Re-run when the skin, subject or data changes, or PolyGerrit has replaced
    // the shadow root and dropped what we built with it.
    const built =
      root.querySelector('[data-gs-gerrit-profile-avatar]') ||
      (viewRoot instanceof ShadowRoot &&
        viewRoot.querySelector('[data-gs-gerrit-repo]'));
    if (header.getAttribute('data-gs-gerrit-profile') === signature && built) {
      return;
    }

    const clear = () => {
      const live = header.shadowRoot;
      if (live) {
        for (const el of live.querySelectorAll(
          '[data-gs-gerrit-rail],[data-gs-gerrit-profile-avatar]',
        )) {
          el.remove();
        }
      }
      const view = header.getRootNode();
      if (view instanceof ShadowRoot) {
        for (const el of view.querySelectorAll(
          '[data-gs-gerrit-content],[data-gs-gerrit-repo]',
        )) {
          el.remove();
        }
        for (const w of view.querySelectorAll(
          '[data-gs-gerrit-view],[data-gs-gerrit-hidden]',
        )) {
          w.removeAttribute('data-gs-gerrit-view');
          w.removeAttribute('data-gs-gerrit-hidden');
        }
      }
      gerritProfileSheets.clear();
      gerritViewSheets.clear();
    };

    ledger(header, 'gerrit-profile', () => ({
      restore: () => {
        header.removeAttribute('data-gs-gerrit-profile');
        clear();
      },
    }));

    clear();
    header.setAttribute('data-gs-gerrit-profile', signature);

    // A project query is a repository, so it wears the product's repo page; only
    // an account query wears the profile.
    if (kind === 'project') {
      paintGerritRepoPage(t, {
        root,
        viewRoot,
        wrapper,
        subject,
        data,
        repoInfo,
      });
      return;
    }

    const changes = data ? data.changes : [];

    // The identity is the *author* of the changes, not the project path: a
    // Gerrit query page is the closest thing to that author's profile. Pick the
    // most frequent owner; fall back to the header's own name.
    const owners = new Map();
    for (const change of changes) {
      const owner = change.owner;
      if (!owner) continue;
      const key = owner._account_id || owner.name || owner.email;
      const entry = owners.get(key) || { owner, count: 0 };
      entry.count += 1;
      owners.set(key, entry);
    }
    const dominant = [...owners.values()].sort((a, b) => b.count - a.count)[0];
    const heading = root.querySelector('h1');
    const displayName =
      (dominant && dominant.owner.name) ||
      (heading && heading.textContent.trim()) ||
      subject;
    const account =
      dominant && (dominant.owner.username || dominant.owner.email);

    // The avatar: the account's own image, or a monogram for the author.
    if (!root.querySelector('gr-avatar')) {
      const avatar = document.createElement('span');
      avatar.setAttribute('data-gs-gerrit-profile-avatar', '');
      avatar.setAttribute('data-gs-ux-skip', '');
      avatar.textContent = (displayName.match(/[a-z0-9]/i) || [
        '?',
      ])[0].toUpperCase();
      root.insertBefore(avatar, root.firstChild);
    }

    // The rail: the author's identity, plus the product's extra blocks.
    const rail = document.createElement('div');
    rail.setAttribute('data-gs-gerrit-rail', '');
    rail.setAttribute('data-gs-ux-skip', '');
    const nameEl = document.createElement('div');
    nameEl.className = 'gs-gerrit-name';
    nameEl.textContent = displayName;
    rail.appendChild(nameEl);
    if (heading) hide(heading, true);
    for (const item of furniture.rail) {
      if (item.kind === 'handle') {
        const el = document.createElement('div');
        el.className = 'gs-gerrit-handle';
        const id = account || subject;
        el.textContent = id.includes('@') ? id : '@' + id;
        rail.appendChild(markNoEquiv(el, 'No @handle on Gerrit'));
      } else if (item.kind === 'bio') {
        if (data && data.description) {
          const el = document.createElement('div');
          el.className = 'gs-gerrit-bio';
          el.textContent = data.description;
          rail.appendChild(el);
        }
      } else if (item.kind === 'follow') {
        const el = document.createElement('button');
        el.type = 'button';
        el.disabled = true;
        el.className = 'gs-gerrit-follow';
        el.textContent = 'Follow';
        rail.appendChild(markNoEquiv(el, 'Gerrit has no follow'));
      } else if (item.kind === 'stats') {
        const authors = new Set(
          changes.map((c) => c.owner && c.owner.name).filter(Boolean),
        ).size;
        const el = document.createElement('div');
        el.className = 'gs-gerrit-stats';
        el.innerHTML =
          `<span><b>${changes.length}</b> changes</span>` +
          `<span><b>${authors}</b> ${authors === 1 ? 'author' : 'authors'}</span>`;
        rail.appendChild(el);
      } else if (item.kind === 'achievements') {
        const head = document.createElement('div');
        head.className = 'gs-gerrit-misshead';
        head.textContent = 'Achievements';
        rail.appendChild(markNoEquiv(head, 'Gerrit has no achievements'));
        rail.appendChild(missingBox('No equivalent on Gerrit.'));
      } else if (item.kind === 'social') {
        const head = document.createElement('div');
        head.className = 'gs-gerrit-misshead';
        head.textContent = 'Followers / Following';
        rail.appendChild(markNoEquiv(head, 'Gerrit has no social graph'));
        rail.appendChild(missingBox('No equivalent on Gerrit.'));
      }
    }
    if (heading) heading.after(rail);

    // The content column: the product's profile tabs and sections.
    if (wrapper && viewRoot instanceof ShadowRoot) {
      const content = document.createElement('div');
      content.setAttribute('data-gs-gerrit-content', '');
      content.setAttribute('data-gs-ux-skip', '');

      const counts = {
        changes: changes.length,
        repos: new Set(changes.map((c) => c.project).filter(Boolean)).size,
      };
      const nav = document.createElement('nav');
      nav.setAttribute('data-gs-gerrit-profile-nav', '');
      nav.setAttribute('data-gs-ux-skip', '');
      furniture.tabs.forEach((tab, index) => {
        if (tab.source) {
          const anchor = document.createElement('a');
          anchor.setAttribute('href', route + subject);
          anchor.textContent = tab.label;
          if (index === 0) anchor.setAttribute('aria-current', 'page');
          const count = counts[tab.source];
          if (count) {
            const pill = document.createElement('span');
            pill.className = 'gs-gerrit-count';
            pill.textContent = String(count);
            anchor.appendChild(pill);
          }
          nav.appendChild(anchor);
        } else {
          const span = document.createElement('span');
          span.className = 'gs-gerrit-tab';
          span.textContent = tab.label;
          nav.appendChild(markNoEquiv(span, 'No equivalent on Gerrit'));
        }
      });
      content.appendChild(nav);

      for (const section of furniture.sections) {
        const heading = document.createElement('h2');
        heading.className = 'gs-gerrit-h2';
        heading.textContent = section.heading;
        if (!section.source) {
          content.appendChild(markNoEquiv(heading, 'No equivalent on Gerrit'));
          content.appendChild(missingBox('No equivalent on Gerrit.'));
          continue;
        }
        if (section.note) markNoEquiv(heading, section.note);
        content.appendChild(heading);

        if (section.source === 'cards') {
          // Pinned holds repositories, so the card is the project itself — its
          // name is the repo, not a change subject.
          const cards = document.createElement('div');
          cards.className = 'gs-gerrit-cards';
          const repos = [
            ...new Set(changes.map((c) => c.project).filter(Boolean)),
          ];
          for (const repo of repos) {
            const forRepo = changes.filter((c) => c.project === repo);
            const branch = (forRepo.find((c) => c.branch) || {}).branch;
            const count = forRepo.length;
            const description =
              repo === subject && data && data.description
                ? data.description
                : `${count} open ${count === 1 ? 'change' : 'changes'}`;
            const card = document.createElement('div');
            card.className = 'gs-gerrit-card';
            card.innerHTML =
              `<div class="name"><a href="/q/project:${escapeHtml(repo)}">` +
              `${escapeHtml(repo)}</a>` +
              `<span class="gs-gerrit-pill">Public</span></div>` +
              `<div class="desc">${escapeHtml(description)}</div>` +
              `<div class="foot"><span>${escapeHtml(branch || '')}</span>` +
              `<span>${count} open ${count === 1 ? 'change' : 'changes'}</span></div>`;
            cards.appendChild(card);
          }
          content.appendChild(cards);
        } else if (section.source === 'graph') {
          const byDay = {};
          for (const change of changes) {
            const day = gerritDate(change.updated);
            if (!day) continue;
            const key = day.toISOString().slice(0, 10);
            byDay[key] = (byDay[key] || 0) + 1;
          }
          const graph = document.createElement('div');
          graph.className = 'gs-gerrit-graph';
          const levels = [
            '#ebedf0',
            '#9be9a8',
            '#40c463',
            '#30a14e',
            '#216e39',
          ];
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const start = new Date(today);
          start.setUTCDate(start.getUTCDate() - 52 * 7);
          start.setUTCDate(start.getUTCDate() - start.getUTCDay());
          for (let w = 0; w < 53; w += 1) {
            for (let d = 0; d < 7; d += 1) {
              const day = new Date(start);
              day.setUTCDate(start.getUTCDate() + w * 7 + d);
              const key = day.toISOString().slice(0, 10);
              const n = byDay[key] || 0;
              const level =
                n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4;
              const cell = document.createElement('span');
              cell.style.background = levels[level];
              cell.title = `${key}: ${n}`;
              graph.appendChild(cell);
            }
          }
          content.appendChild(graph);

          // The changes themselves, as the profile's activity rows.
          const list = document.createElement('div');
          list.className = 'gs-gerrit-changes';
          for (const change of changes
            .slice()
            .sort((a, b) => String(b.updated).localeCompare(String(a.updated)))
            .slice(0, 8)) {
            const row = document.createElement('div');
            row.className = 'gs-gerrit-change';
            row.innerHTML =
              `<a href="/c/${escapeHtml(change.project)}/+/${change._number}">` +
              `${escapeHtml(change.subject)}</a>` +
              `<span>${escapeHtml(change.owner && change.owner.name)}</span>`;
            list.appendChild(row);
          }
          content.appendChild(list);
        }
      }

      wrapper.setAttribute('data-gs-gerrit-view', '');
      wrapper.insertBefore(content, wrapper.querySelector('gr-change-list'));
      gerritViewSheets.adopt(viewRoot, gerritViewCss(t));
    }

    gerritProfileSheets.adopt(root, gerritRailCss());
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
        if (
          el.closest(
            '[data-gs-gerrit-nav],[data-gs-gerrit-profile-nav],' +
              '[data-gs-gerrit-rail],[data-gs-gerrit-content],' +
              '[data-gs-gerrit-repo]',
          )
        ) {
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
