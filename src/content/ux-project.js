/**
 * gitalike — UX content script: project pages.
 *
 * The metadata block, its heading, the rebuilt project tab strip and the active
 * tab; and Gitea/Forgejo's own rebuilt nav. See ux-core.js for the shared
 * runtime and ux.js for the entry point.
 */
(() => {
  'use strict';

  const rt = globalThis.GITALIKE_UX_RUNTIME;
  if (!rt) return;
  const { UX, SELECTORS, layoutOf, hide, textNodes, rememberText, cloneClean } =
    rt;

  // GitLab's "Project information" lists a fixed set of items; GitHub's "About"
  // sidebar lists a different set (Releases, Packages, Used by, Contributors,
  // Languages). On the GitLab skin the GitHub-only sections are hidden so the
  // block shows the items GitLab's project page does.
  function paintMetadata(t) {
    if (layoutOf(t) !== 'gitlab') return;
    const grid = document.querySelector(SELECTORS.github.metadataSidebar);
    if (!grid) return;
    for (const section of grid.children) {
      const heading = section.querySelector('h2, h3');
      const label = UX.sectionLabelText(heading && heading.textContent);
      if (!UX.METADATA_HIDE.includes(label)) continue;
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

  rt.once('project', () => {
    rt.globalPasses.push(
      paintGiteaNav,
      paintMetadata,
      paintAboutExtras,
      paintHeadings,
      paintProjectTabs,
      paintActiveTab,
    );
  });
})();
