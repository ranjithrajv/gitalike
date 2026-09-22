/**
 * GitAlike — UX content script: profile pages.
 *
 * The About/Info/Contact rail, the follower/following copies and the rebuilt
 * profile menu. See ux-core.js for the shared runtime and ux.js for the entry.
 */
(() => {
  'use strict';

  const rt = globalThis.GITALIKE_UX_RUNTIME;
  if (!rt) return;
  const {
    UX,
    SELECTORS,
    hide,
    release,
    releaseWithin,
    setOrder,
    textNodes,
    rememberText,
    cloneClean,
  } = rt;

  // GitLab keeps the organization, location and contact links in a right-hand
  // "About / Info / Contact" rail beside the identity; GitHub stacks them under
  // the avatar. On the GitLab skin they are cloned into a rail built here and
  // the originals are hidden, so the card reads like GitLab's profile.
  function paintProfileRail(t) {
    if (t !== 'gitlab') return;
    if (!document.querySelector(SELECTORS.github.profileNav)) return;
    const editable = document.querySelector(SELECTORS.github.profileEditable);
    if (!editable) return;
    const details = [
      ...editable.querySelectorAll(SELECTORS.github.profileDetail),
    ].filter((d) => !d.closest('[data-gs-profile-rail]'));
    const user = location.pathname.split('/').filter(Boolean)[0] || '';
    const signature = `${user}:${details.map((d) => d.textContent.trim()).join('|')}`;
    let rail = editable.querySelector('[data-gs-profile-rail]');
    if (rail && rail.getAttribute('data-gs-signature') === signature) return;
    if (rail) rail.remove();
    // The details the old rail hid are released, then re-hidden below if they
    // are still in it; one no longer in it is shown again.
    for (const el of rt.rail.details) release(el, 'display');
    rt.rail.details = new Set();
    if (!details.length) return;
    rail = document.createElement('div');
    rail.setAttribute('data-gs-profile-rail', '');
    rail.setAttribute('data-gs-ux-skip', '');
    rail.setAttribute('data-gs-signature', signature);
    const groups = { About: [], Info: [], Contact: [] };
    // The `itemprop` sits on the detail element itself, not a descendant.
    const has = (d, sel) => d.matches(sel) || !!d.querySelector(sel);
    const groupOf = (d) =>
      has(d, SELECTORS.github.profileOrg)
        ? 'About'
        : has(d, SELECTORS.github.profileLocation)
          ? 'Info'
          : 'Contact';
    for (const d of details) groups[groupOf(d)].push(d);
    for (const [name, list] of Object.entries(groups)) {
      if (!list.length) continue;
      const heading = document.createElement('h3');
      heading.className = 'gs-profile-rail-heading';
      heading.textContent = name;
      rail.appendChild(heading);
      for (const d of list) {
        rail.appendChild(cloneClean(d));
        hide(d, true);
        rt.rail.details.add(d);
      }
    }
    editable.appendChild(rail);
  }

  // GitLab keeps the follower/following counts in the profile navigation, but
  // GitHub shows them under the photo. On a GitLab profile shown as GitHub they
  // are copied into the card (the originals are hidden in CSS); the copies are
  // rebuilt only when the counts change, and removed on revert.
  function paintProfileStats(t) {
    if (t !== 'github') return;
    if (!document.body || document.body.dataset.page !== 'users:show') return;
    const identity = document.querySelector(SELECTORS.gitlab.profileIdentity);
    if (!identity) return;
    const links = [
      ...document.querySelectorAll(
        `${SELECTORS.gitlab.followersLink}, ${SELECTORS.gitlab.followingLink}`,
      ),
    ];
    if (!links.length) return;
    const signature = links
      .map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim())
      .join(' | ');
    const existing = identity.querySelector('[data-gs-profile-stats]');
    if (existing && existing.dataset.gsSignature === signature) return;
    const box = existing || document.createElement('div');
    box.setAttribute('data-gs-profile-stats', '');
    box.setAttribute('data-gs-ux-skip', '');
    box.replaceChildren();
    for (const link of links) {
      const clone = cloneClean(link);
      clone.removeAttribute('id');
      clone.setAttribute('data-gs-ux-skip', '');
      box.appendChild(clone);
    }
    box.dataset.gsSignature = signature;
    if (!existing) identity.appendChild(box);
  }

  /** The label of an item: its text without the icon, counter or `≠` badge. */
  function profileLabelOf(el) {
    return textNodes(el)
      .map((n) => n.nodeValue)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Relabel one item by replacing the text node that holds its label, so the
  // icon and any counter are left in place.
  function setProfileLabel(el, key, to) {
    for (const text of textNodes(el)) {
      const current = text.nodeValue.trim();
      if (!UX.labelMatches(current, key)) continue;
      rememberText(text);
      const next = text.nodeValue.replace(current, to);
      if (text.nodeValue !== next) text.nodeValue = next;
      return;
    }
  }

  function resetProfileMenu(container) {
    for (const el of container.querySelectorAll('[data-gs-profile-menu]')) {
      el.remove();
    }
    releaseWithin(container, 'display');
    releaseWithin(container, 'style-order');
  }

  function profileMenuContainers(sourceIsGitlab) {
    const key = sourceIsGitlab ? 'gitlab-source' : 'github-source';
    const cache = rt.profileContainerCache;
    if (
      cache.key === key &&
      cache.list.length &&
      cache.list.every((el) => el.isConnected)
    ) {
      return cache.list;
    }
    cache.key = key;
    cache.list = sourceIsGitlab
      ? [...document.querySelectorAll(SELECTORS.gitlab.profileMenu)]
      : [...document.querySelectorAll(SELECTORS.github.profileMenu)];
    return cache.list;
  }

  // A profile page's navigation is a different set of destinations on each
  // product, so it is rebuilt as the applied product's menu (`UX.PROFILE_MENU`)
  // — same labels, same order, same options — rather than shown as a mix. Where
  // the applied product has no page for an item, the closest real page on the
  // source product is used: GitLab's activity and contributed-project views are
  // part of GitHub's Overview, GitHub's organizations are a tab, and gists live
  // on gist.github.com. GitLab's menu omits Packages, which has no user-level
  // GitLab page (GitHub itself hides Packages when there are none).
  function paintProfileMenu(t) {
    const build = UX.PROFILE_MENU[t];
    if (!build || !document.body) return;

    // The source, not the target, decides where the menu lives: a Bitbucket
    // target can be worn by either forge, and its menu must still find the
    // source's container. `gs-source` is set by content/theme.js from the shared
    // tables; fall back to the two-way assumption when it is absent.
    const source =
      document.documentElement.dataset.gsSource ||
      (t === 'github' ? 'gitlab' : 'github');
    const sourceIsGitlab = source === 'gitlab';
    // GitLab's profile menu lives in the super sidebar — which every project
    // page has too — so only rebuild it on an actual profile page. Without this
    // the project sidebar's static, pinned and group sections each got GitHub's
    // profile menu, tripling it and hiding the project navigation.
    if (sourceIsGitlab && document.body.dataset.page !== 'users:show') return;
    const containers = profileMenuContainers(sourceIsGitlab);
    if (!containers.length) return;

    // GitHub's card has no "About"/"Info"/"Contact" headings; GitLab's card
    // does, so they are dropped rather than left as foreign labels.
    if (sourceIsGitlab) {
      for (const heading of document.querySelectorAll(
        SELECTORS.gitlab.profileSidebar,
      )) {
        const text = (heading.textContent || '').trim();
        if (text === 'About' || text === 'Info' || text === 'Contact') {
          hide(heading.closest('li') || heading, true);
        }
      }
    }

    const user = location.pathname.split('/').filter(Boolean)[0] || '';
    if (!user) return;
    const name = (
      (
        document.querySelector(
          sourceIsGitlab
            ? SELECTORS.gitlab.profileName
            : SELECTORS.github.profileName,
        ) || {}
      ).textContent || ''
    ).trim();
    if (!sourceIsGitlab && !name) return;
    const items = build(user, name);
    const signature = `${t}:${user}`;

    for (const container of containers) {
      if (
        container.getAttribute('data-gs-profile-menu-signature') === signature
      ) {
        continue;
      }
      resetProfileMenu(container);
      container.setAttribute('data-gs-profile-menu-signature', signature);

      const anchors = [...container.querySelectorAll('a')];
      const used = new Set();
      items.forEach(([label, href, source], index) => {
        let anchor = null;
        if (source === '@first') {
          anchor = anchors[0] || null;
        } else if (source) {
          anchor =
            anchors.find(
              (a) => !used.has(a) && UX.labelMatches(profileLabelOf(a), source),
            ) || null;
        }
        if (anchor) {
          used.add(anchor);
          const key = source === '@first' ? profileLabelOf(anchor) : source;
          setProfileLabel(anchor, key, label);
          anchor.setAttribute('href', href);
          const holder = sourceIsGitlab
            ? anchor.closest('li') || anchor
            : anchor;
          // The label-match pass may have hidden this item before the menu was
          // rebuilt; it belongs to the applied product's menu, so show it again.
          holder.style.removeProperty('display');
          setOrder(holder, String(index));
          return;
        }
        const anchorNew = document.createElement('a');
        anchorNew.textContent = label;
        anchorNew.setAttribute('href', href);
        let holder = anchorNew;
        if (sourceIsGitlab) {
          holder = document.createElement('li');
          holder.setAttribute('data-gs-profile-menu', '');
          holder.appendChild(anchorNew);
        } else {
          anchorNew.setAttribute('data-gs-profile-menu', '');
        }
        setOrder(holder, String(index));
        container.appendChild(holder);
      });

      for (const child of [...container.children]) {
        if (child.hasAttribute('data-gs-profile-menu')) continue;
        const anchor = child.matches('a')
          ? child
          : child.querySelector(':scope > a');
        if (anchor && used.has(anchor)) continue;
        hide(child, true);
      }
    }
  }

  // Gitea/Forgejo profiles put the avatar, name, bio and website in a header row
  // at the top. Under a sidebar layout that header becomes the left rail, with
  // the tab menu and content beside it — the GitLab profile shape, built from
  // Gitea's own (semantic) classes. GitHub's row layout is left as Gitea's.
  function paintGiteaProfile(t) {
    if (document.documentElement.dataset.gsSource !== 'gitea') return;
    if (t !== 'gitlab' && t !== 'bitbucket') return;
    const root = document.querySelector(
      '.page-content.user.profile, .page-content.organization.profile',
    );
    if (!root) return;
    const header = [...root.querySelectorAll(':scope > .ui.container')].find(
      (el) => el.querySelector('.org-header, .user-header, .flex-item-header'),
    );
    if (!header) return;
    rt.ledger(header, 'gitea-profile-rail', () => ({
      restore: () => header.removeAttribute('data-gs-profile-rail'),
    }));
    header.setAttribute('data-gs-profile-rail', '');
  }

  // The profile activity section is worded differently by each product: GitHub
  // heads its timeline "Contribution activity" (and summarises it as "Activity
  // overview") with a "Show more activity" control; GitLab and Bitbucket just
  // say "Activity". The feed's rows and the contribution calendar are handled
  // elsewhere — the copy tables and the palette — so only the framing is
  // relabelled, and only on a profile page: a repository's own "Activity" must
  // not change. The source declares the words it uses (`SOURCE_ACTIVITY`), the
  // skin the applied product's (`ACTIVITY`), and a source that declares none
  // (Gerrit) is skipped. If the upstream wording moves, the pass is a no-op
  // rather than a broken selector.
  const normalise = (text) => (text || '').replace(/\s+/g, ' ').trim();

  function renameExact(el, from, to) {
    for (const text of textNodes(el)) {
      const current = text.nodeValue.trim();
      if (current !== from) continue;
      rememberText(text);
      const next = text.nodeValue.replace(current, to);
      if (text.nodeValue !== next) text.nodeValue = next;
      return;
    }
  }

  function onProfilePage(source) {
    if (source === 'github') {
      return !!document.querySelector(SELECTORS.github.profileNav);
    }
    if (source === 'gitlab') {
      return document.body.dataset.page === 'users:show';
    }
    if (source === 'gitea') {
      return !!document.querySelector(
        '.page-content.user.profile, .page-content.organization.profile',
      );
    }
    if (source === 'bitbucket') {
      return /(?:^|\/)(workspace|repositories|projects|snippets|stars|overview|activity)(\/|$)/.test(
        location.pathname,
      );
    }
    return false;
  }

  function paintProfileActivity(t) {
    const target = UX.ACTIVITY[t];
    const source = document.documentElement.dataset.gsSource;
    const words = UX.SOURCE_ACTIVITY[source];
    if (!target || !words || source === t || !onProfilePage(source)) return;

    const headings = words.headings ?? [];
    for (const heading of document.querySelectorAll('h1, h2, h3, h4')) {
      if (heading.closest('[data-gs-ux-skip]')) continue;
      const text = normalise(heading.textContent);
      if (headings.includes(text)) renameExact(heading, text, target.heading);
    }

    const more = words.more ?? [];
    if (!more.length) return;
    for (const control of document.querySelectorAll('button, a, summary')) {
      if (control.closest('[data-gs-ux-skip]')) continue;
      const text = normalise(control.textContent);
      if (more.includes(text)) renameExact(control, text, target.more);
    }
  }

  rt.once('profile', () => {
    rt.globalPasses.push(
      paintProfileRail,
      paintProfileStats,
      paintProfileMenu,
      paintGiteaProfile,
      paintProfileActivity,
    );
  });
})();
