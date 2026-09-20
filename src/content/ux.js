/**
 * gitalike — UX content script.
 *
 * The colour skin is done entirely in CSS; this script carries the part CSS
 * cannot: the words, the reference markers, the app-navigation order and the
 * keyboard combos. It is active only while one of the theme classes is on
 * <html>, and every change it makes is recorded so it can be undone exactly
 * when the skin is switched off.
 *
 *   html.gs-theme-gitlab   a GitHub site -> GitHub words become GitLab's
 *   html.gs-theme-github   a GitLab site -> GitLab words become GitHub's
 *
 * Deliberately conservative:
 *   - code, inputs, editable regions and anything marked [data-gs-ux-skip] are
 *     never rewritten;
 *   - navigation labels only change on an exact whole-label match inside a
 *     known navigation region, so marketing copy is safe;
 *   - control labels ("Merge", "Rebase") only change on an exact whole-label
 *     match on a button, tab, menu item or link, never in prose;
 *   - a feature the other product does not have is not translated — it is
 *     marked with a .gs-no-equiv badge saying so;
 *   - the nav is only reordered by moving its items among the slots they
 *     already occupy, so children we do not recognise stay where they are.
 *
 * Limitations worth knowing: text updates the site makes *inside* an already
 * processed node are not re-translated (SPA re-renders that replace nodes are),
 * and the keyboard remap falls back to synthetic key events for destinations
 * with no navigation link — which a site that checks `event.isTrusted` (GitLab)
 * would ignore, so those combos are delivered as a click where a link exists.
 */
(() => {
  'use strict';

  const SITES = globalThis.GITALIKE;
  const UX = globalThis.GITALIKE_UX;
  if (!SITES || !UX || typeof document === 'undefined') return;

  // A page can receive this script both from the registered content script and
  // from the one-off injection used when its host is added while it is open;
  // only the first needs to wire anything up.
  if (globalThis.__gitalikeUx) return;
  globalThis.__gitalikeUx = true;

  const root = document.documentElement;
  // Which themes exist is derived from the shared `kinds` table, not listed here.
  const THEMES = SITES.THEMES;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'CODE', 'PRE', 'KBD', 'SAMP',
    'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  ]);
  const SKIP_SELECTOR =
    'script,style,noscript,template,code,pre,[contenteditable=""],[contenteditable="true"],[data-gs-ux-skip]';
  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const ATTR_SELECTOR = ATTRS.map((a) => `[${a}]`).join(',');
  const REF_SELECTOR = 'a[href*="/pull/"],a[href*="/merge_requests/"]';

  // Iterable (not WeakMap) because reverting has to walk them.
  const textOrig = new Map();
  const attrOrig = new Map();
  const refOrig = new Map();
  const orderOrig = new Map();
  const orderStamp = new WeakMap();
  const markerOrig = new Map();
  const hiddenOrig = new Map();
  // A NAV_RULES rule resolves to one container; keep it while that container is
  // still in the page so later mutation flushes do not re-scan the document.
  const navContainer = new WeakMap();

  let theme = null;
  let domObserver = null;
  let classObserver = null;
  let gPending = 0;
  let keyHandler = null;
  let lastSweep = 0;

  const themeOf = () =>
    THEMES.find((name) => root.classList.contains(`gs-theme-${name}`)) || null;

  /* ---------------------------------------------------------- utilities -- */

  function scope(node, selector) {
    const out = [];
    if (!node) return out;
    if (node.nodeType === 1 && node.matches(selector)) out.push(node);
    if (node.querySelectorAll) {
      // A loop rather than a spread: querySelectorAll can return thousands of
      // nodes, and spreading that many arguments risks the call stack.
      for (const el of node.querySelectorAll(selector)) out.push(el);
    }
    return out;
  }

  // A subtree the walker must not descend into at all: an editable region or
  // anything the site has marked, exactly what the old closest() test caught.
  function isSkipped(el) {
    return el.isContentEditable || el.matches(SKIP_SELECTOR);
  }

  /**
   * Visit every translatable text node under `root`, carrying whether it sits
   * inside a control (UX.LABEL_SCOPE). One traversal replaces the separate
   * "translate the copy" and "translate the control label" walks. Skip regions
   * are pruned per element instead of asking closest() per text node; elements
   * that only skip their *own* text (kbd, samp, …) still have their descendants
   * visited, matching the original per-parent check.
   */
  function walkText(root, visit) {
    if (!root || root.nodeType !== 1) return;
    const stack = [[root, false]];
    while (stack.length) {
      const [el, inherited] = stack.pop();
      if (isSkipped(el)) continue;
      const control = inherited || el.matches(UX.LABEL_SCOPE);
      const skipOwnText = SKIP_TAGS.has(el.tagName);
      for (let child = el.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3) {
          if (!skipOwnText && child.nodeValue && child.nodeValue.trim()) {
            visit(child, control);
          }
        } else if (child.nodeType === 1) {
          stack.push([child, control]);
        }
      }
    }
  }

  function textNodes(node) {
    if (!node) return [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const parent = n.parentElement;
        if (!parent || SKIP_TAGS.has(parent.tagName) || parent.isContentEditable) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const out = [];
    let n;
    while ((n = walker.nextNode())) out.push(n);
    return out;
  }

  function rememberText(node) {
    if (!textOrig.has(node)) textOrig.set(node, node.nodeValue);
    return textOrig.get(node);
  }

  /* -------------------------------------------------------------- paints -- */

  // Copy and control labels in one traversal. Inside a control (UX.LABEL_SCOPE)
  // the *original* whole label is matched first, so a label that also contains a
  // phrase ("Merge pull request") gets its exact word ("Merge") rather than being
  // mangled by phrase translation first. Everything else is phrase-translated.
  function paintCopy(node, t) {
    walkText(node, (text, isControl) => {
      const original = rememberText(text);
      const value = isControl
        ? UX.controlLabel(original.trim(), t) ?? UX.translate(original, t)
        : UX.translate(original, t);
      if (value !== text.nodeValue) text.nodeValue = value;
    });
  }

  function paintAttrs(node, t) {
    for (const el of scope(node, ATTR_SELECTOR)) {
      let store = attrOrig.get(el);
      for (const attr of ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        if (!store) {
          store = {};
          attrOrig.set(el, store);
        }
        if (!(attr in store)) store[attr] = el.getAttribute(attr);
        const next = UX.translate(store[attr], t);
        if (next !== el.getAttribute(attr)) el.setAttribute(attr, next);
      }
    }
  }

  function paintRefs(node, t) {
    for (const anchor of scope(node, REF_SELECTOR)) {
      const marker = UX.refMarker(anchor.getAttribute('href'), t);
      if (!marker) continue;
      const current = (anchor.textContent || '').trim();
      // Only touch links that are *just* a reference (optionally with its
      // existing # / ! marker), never a title with the number in it.
      if (!/^[#!]?\d+$/.test(current)) continue;
      if (!refOrig.has(anchor)) refOrig.set(anchor, anchor.textContent);
      if (current !== marker) anchor.textContent = marker;
    }
  }

  // Hide the items the applied product has no page for, so the menu is the
  // applied product's menu rather than a mix of both. Runs before paintUnmapped
  // so it sees the clean label, not one with a badge on it.
  function paintNavHide(node, t) {
    if (!UX.NAV_HIDE[t]) return;
    for (const region of scope(node, UX.NAV_SCOPE)) {
      for (const el of scope(region, 'a,button,summary')) {
        const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!UX.navHidden(label, t)) continue;
        const target = el.closest('li') || el;
        if (!hiddenOrig.has(target)) hiddenOrig.set(target, target.style.display);
        if (target.style.display !== 'none') target.style.display = 'none';
      }
    }
  }

  function paintUnmapped(node, t) {
    const mark = (el) => {
      // Already marked: leave it, so the badge's own text never feeds back into
      // the label we match on.
      if (el.hasAttribute('data-gs-no-equiv')) return;
      const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const missing = UX.noEquivalentFor(label, t);
      if (!missing) return;
      const badge = document.createElement('span');
      badge.className = 'gs-no-equiv';
      badge.setAttribute('data-gs-ux-skip', '');
      // Deliberately not aria-hidden: the marker should reach screen readers too,
      // so the feature is not announced as if it existed here.
      badge.textContent = `≠ ${missing}`;
      el.appendChild(badge);
      el.setAttribute('data-gs-no-equiv', missing);
      markerOrig.set(badge, el);
    };
    for (const region of scope(node, UX.NAV_SCOPE)) {
      for (const el of scope(region, 'a,button,summary')) mark(el);
    }
    for (const el of scope(node, UX.LABEL_SCOPE)) mark(el);
  }

  function paintNav(node, t) {
    const map = UX.NAV[t] || {};
    // NAV_SCOPE selects the navigation *regions*; the labels live on the
    // anchors and buttons inside them. Matching per text node (not the whole
    // control) is what lets a label with a counter — "Work items -", where the
    // dash is a separate node — still be relabelled.
    for (const region of scope(node, UX.NAV_SCOPE)) {
      for (const el of scope(region, 'a,button,summary')) {
        for (const text of textNodes(el)) {
          const label = text.nodeValue.trim();
          if (!Object.prototype.hasOwnProperty.call(map, label)) continue;
          rememberText(text);
          if (text.nodeValue !== map[label]) text.nodeValue = map[label];
        }
      }
    }
  }

  function resolveContainer(rule) {
    if (rule.container) return document.querySelector(rule.container);
    if (!rule.scope || !rule.contains) return null;
    const norm = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
    let best = null;
    let bestCount = 0;
    for (const region of document.querySelectorAll(rule.scope)) {
      for (const el of region.querySelectorAll('ul,ol,div')) {
        const items = [...el.children].filter(
          (c) => c.matches(rule.item) && !c.classList.contains('gs-nav-group'),
        );
        if (items.length < 2 || items.length <= bestCount) continue;
        // The container must hold the named item as one of its own children —
        // exact match, so a longer label ("Code review analytics") never counts.
        if (![...el.children].some((c) => norm(c) === rule.contains)) continue;
        best = el;
        bestCount = items.length;
      }
    }
    return best;
  }

  // The resolved container for a rule, cached while it is still in the page.
  // Falls back to a full-document scan only when it is missing or was replaced.
  function containerFor(rule) {
    const cached = navContainer.get(rule);
    if (cached && cached.isConnected) return cached;
    const found = resolveContainer(rule);
    if (found) navContainer.set(rule, found);
    return found;
  }

  function paintOrder(t) {
    for (const rule of UX.NAV_RULES[t] || []) {
      const container = containerFor(rule);
      if (!container) continue;
      const children = [...container.children];
      const items = children.filter(
        (c) => c.matches(rule.item) && !c.classList.contains('gs-nav-group'),
      );
      if (items.length < 2) continue;
      const labels = items.map((el) => (el.textContent || '').trim());
      const sorted = UX.orderIndexes(labels, rule.order).map((i) => items[i]);
      // Fill the item *slots* with the sorted items; children that are not
      // items stay exactly where they are. That is what makes an unfamiliar
      // markup change degrade to "no reorder" instead of a mangled nav.
      const itemSet = new Set(items);
      let slot = 0;
      const next = children.map((child) => (itemSet.has(child) ? sorted[slot++] : child));
      if (next.every((child, i) => child === children[i])) continue;
      // A framework that re-renders its list would undo this and, if we kept
      // re-applying, thrash. Reorder once, then leave it be for a moment.
      const now = Date.now();
      if (orderStamp.has(container) && now - orderStamp.get(container) < 1000) continue;
      orderStamp.set(container, now);
      if (!orderOrig.has(container)) orderOrig.set(container, children);
      // One replaceChildren instead of a re-append per child: fewer layout
      // passes, and the observer never sees the intermediate order.
      const watching = Boolean(domObserver);
      if (watching) unwatchBody();
      container.replaceChildren(...next);
      if (watching) watchBody();
    }
  }

  // Insert GitLab-style group headings into the (now ordered) sidebar. Runs
  // after paintOrder so the headings land on the final order, and rebuilds only
  // when the headings no longer match — otherwise our own insertions would feed
  // back through the mutation observer.
  function paintNavGroups(t) {
    if (!UX.NAV_GROUPS[t]) return;
    // The group headings apply to the same list paintOrder resolves, so reuse
    // that container instead of re-scanning every NAV_SCOPE region per flush.
    const rule = (UX.NAV_RULES[t] || []).find((r) => r.container);
    const ul = rule ? containerFor(rule) : null;
    if (!ul) return;
    const items = [...ul.children].filter(
      (c) => c.matches('li') && !c.classList.contains('gs-nav-group'),
    );
    const desired = [];
    let last = null;
    for (const li of items) {
      const label = (li.textContent || '').replace(/\s+/g, ' ').trim();
      const group = UX.navGroupFor(label, t);
      if (group && group !== last) {
        desired.push({ group, before: li });
        last = group;
      }
    }
    const current = [...ul.querySelectorAll(':scope > .gs-nav-group')];
    const ok =
      current.length === desired.length &&
      current.every(
        (el, i) =>
          el.textContent === desired[i].group &&
          el.nextElementSibling === desired[i].before,
      );
    if (ok) return;
    for (const el of current) el.remove();
    for (const entry of desired) {
      const heading = document.createElement('li');
      heading.className = 'gs-nav-group';
      heading.setAttribute('data-gs-ux-skip', '');
      heading.textContent = entry.group;
      ul.insertBefore(heading, entry.before);
    }
  }

  // GitLab keeps the follower/following counts in the profile navigation, but
  // GitHub shows them under the photo. On a GitLab profile shown as GitHub they
  // are copied into the card (the originals are hidden in CSS); the copies are
  // rebuilt only when the counts change, and removed on revert.
  function paintProfileStats(t) {
    if (t !== 'github') return;
    if (!document.body || document.body.dataset.page !== 'users:show') return;
    const identity = document.querySelector(
      '.user-profile-header > div:last-child',
    );
    if (!identity) return;
    const links = [
      ...document.querySelectorAll(
        '.super-sidebar a[data-track-label="followers_menu"],' +
          '.super-sidebar a[data-track-label="following_menu"]',
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
      const clone = link.cloneNode(true);
      clone.removeAttribute('id');
      clone.setAttribute('data-gs-ux-skip', '');
      box.appendChild(clone);
    }
    box.dataset.gsSignature = signature;
    if (!existing) identity.appendChild(box);
  }

  // A profile page's navigation is a different set of destinations on each
  // product, so it is rebuilt as the applied product's menu — same labels, same
  // order, same options — rather than shown as a mix. Where the applied product
  // has no page for an item, the closest real page on the source product is
  // used: GitLab's activity and contributed-project views are part of GitHub's
  // Overview, GitHub's organizations are a tab, and gists live on
  // gist.github.com. GitLab's menu omits Packages, which has no user-level
  // GitLab page (GitHub itself hides Packages when there are none).
  const PROFILE_MENU = {
    // Applied GitHub UI (source GitLab): GitHub's profile tabs, in order.
    github: (u) => [
      ['Overview', `/${u}`, '@first'],
      ['Repositories', `/users/${u}/projects`, 'Personal projects'],
      ['Projects', `/users/${u}/contributed`, 'Contributed projects'],
      ['Packages', `/users/${u}/packages`, null],
      ['Stars', `/users/${u}/starred`, 'Starred projects'],
    ],
    // Applied GitLab UI (source GitHub): GitLab's profile destinations, in order.
    gitlab: (u, name) => [
      [name, `/${u}`, 'Overview'],
      ['Activity', `/${u}?tab=overview`, null],
      ['Groups', `/${u}?tab=organizations`, null],
      ['Contributed projects', `/${u}?tab=overview`, 'Projects'],
      ['Personal projects', `/${u}?tab=repositories`, 'Repositories'],
      ['Starred projects', `/${u}?tab=stars`, 'Stars'],
      ['Snippets', `https://gist.github.com/${u}`, null],
      ['Followers', `/${u}?tab=followers`, null],
      ['Following', `/${u}?tab=following`, null],
    ],
  };
  const profileHiddenOrig = new Map();
  const profileOrderOrig = new Map();

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

  function hideProfileItem(el) {
    const target = el.closest('li') || el;
    // Another pass may already hide it (and own the restore); do not re-store.
    if (target.style.display === 'none') return;
    if (!profileHiddenOrig.has(target)) {
      profileHiddenOrig.set(target, target.style.display);
    }
    target.style.setProperty('display', 'none', 'important');
  }

  function rememberOrder(el) {
    if (!profileOrderOrig.has(el)) profileOrderOrig.set(el, el.style.order);
  }

  function resetProfileMenu(container) {
    for (const el of container.querySelectorAll('[data-gs-profile-menu]')) {
      el.remove();
    }
    for (const [el, display] of [...profileHiddenOrig]) {
      if (!container.contains(el)) continue;
      if (display) el.style.display = display;
      else el.style.removeProperty('display');
      profileHiddenOrig.delete(el);
    }
    for (const [el, order] of [...profileOrderOrig]) {
      if (!container.contains(el)) continue;
      if (order) el.style.order = order;
      else el.style.removeProperty('order');
      profileOrderOrig.delete(el);
    }
  }

  // The containers are looked up on every flush; keep them while they are still
  // in the page so a continuously-mutating profile does not re-scan the document.
  const profileContainerCache = { key: null, list: [] };

  function profileMenuContainers(sourceIsGitlab) {
    const key = sourceIsGitlab ? 'gitlab-source' : 'github-source';
    if (
      profileContainerCache.key === key &&
      profileContainerCache.list.length &&
      profileContainerCache.list.every((el) => el.isConnected)
    ) {
      return profileContainerCache.list;
    }
    profileContainerCache.key = key;
    profileContainerCache.list = sourceIsGitlab
      ? [...document.querySelectorAll('.super-sidebar .gl-scroll-scrim ul')]
      : [...document.querySelectorAll('nav[aria-label="User profile"]')];
    return profileContainerCache.list;
  }

  function paintProfileMenu(t) {
    const build = PROFILE_MENU[t];
    if (!build || !document.body) return;

    const sourceIsGitlab = t === 'github';
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
      for (const heading of document.querySelectorAll('.user-profile-sidebar h2')) {
        const text = (heading.textContent || '').trim();
        if (text === 'About' || text === 'Info' || text === 'Contact') {
          hideProfileItem(heading);
        }
      }
    }

    const user = location.pathname.split('/').filter(Boolean)[0] || '';
    if (!user) return;
    const name = (
      (
        document.querySelector(
          sourceIsGitlab ? '.user-profile-header h1' : '.h-card .p-name',
        ) || {}
      ).textContent || ''
    ).trim();
    if (!sourceIsGitlab && !name) return;
    const items = build(user, name);
    const signature = `${t}:${user}`;

    for (const container of containers) {
      if (container.getAttribute('data-gs-profile-menu-signature') === signature) {
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
          const holder = sourceIsGitlab ? anchor.closest('li') || anchor : anchor;
          rememberOrder(holder);
          // The label-match pass may have hidden this item before the menu was
          // rebuilt; it belongs to the applied product's menu, so show it again.
          holder.style.removeProperty('display');
          holder.style.setProperty('order', String(index));
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
        holder.style.setProperty('order', String(index));
        container.appendChild(holder);
      });

      for (const child of [...container.children]) {
        if (child.hasAttribute('data-gs-profile-menu')) continue;
        const anchor = child.matches('a') ? child : child.querySelector(':scope > a');
        if (anchor && used.has(anchor)) continue;
        if (child.style.display === 'none') continue;
        if (!profileHiddenOrig.has(child)) {
          profileHiddenOrig.set(child, child.style.display);
        }
        child.style.setProperty('display', 'none', 'important');
      }
    }
  }

  // The per-node passes, in one place so a new pass cannot be wired into the
  // initial load but forgotten for the mutations that follow it.
  function paintNode(node, t) {
    paintCopy(node, t);
    paintAttrs(node, t);
    paintRefs(node, t);
    paintNav(node, t);
    paintNavHide(node, t);
    paintUnmapped(node, t);
  }

  function paintAll(t, node = document.body) {
    if (!node) return;
    paintNode(node, t);
    paintOrder(t);
    paintNavGroups(t);
    paintProfileStats(t);
    paintProfileMenu(t);
  }

  /* ------------------------------------------------------------- revert -- */

  function revertAll() {
    for (const [node, value] of textOrig) {
      if (node.isConnected && node.nodeValue !== value) node.nodeValue = value;
    }
    for (const [badge, el] of markerOrig) {
      if (badge.isConnected) badge.remove();
      if (el.isConnected) el.removeAttribute('data-gs-no-equiv');
    }
    for (const [el, display] of hiddenOrig) {
      if (el.isConnected) el.style.display = display;
    }
    for (const [el, store] of attrOrig) {
      if (!el.isConnected) continue;
      for (const attr of Object.keys(store)) el.setAttribute(attr, store[attr]);
    }
    for (const [el, value] of refOrig) {
      if (el.isConnected) el.textContent = value;
    }
    for (const [container, items] of orderOrig) {
      if (container.isConnected) for (const el of items) container.appendChild(el);
    }
    for (const el of document.querySelectorAll('.gs-nav-group')) el.remove();
    for (const el of document.querySelectorAll('[data-gs-profile-stats]')) el.remove();
    for (const el of document.querySelectorAll('[data-gs-profile-menu]')) el.remove();
    for (const [el, display] of profileHiddenOrig) {
      if (!el.isConnected) continue;
      if (display) el.style.display = display;
      else el.style.removeProperty('display');
    }
    for (const [el, order] of profileOrderOrig) {
      if (!el.isConnected) continue;
      if (order) el.style.order = order;
      else el.style.removeProperty('order');
    }
    textOrig.clear();
    attrOrig.clear();
    refOrig.clear();
    orderOrig.clear();
    markerOrig.clear();
    hiddenOrig.clear();
    profileHiddenOrig.clear();
    profileOrderOrig.clear();
    profileContainerCache.key = null;
    profileContainerCache.list = [];
  }

  // Drop the entries the framework has discarded, so the undo ledger cannot hold
  // a detached subtree alive. A node is restored before it is forgotten: if the
  // site later re-attaches it, it comes back with the site's own text and the
  // normal paint records it again, so a revert stays exact.
  function forgetDetached() {
    for (const [node, value] of textOrig) {
      if (node.isConnected) continue;
      node.nodeValue = value;
      textOrig.delete(node);
    }
    for (const [el, store] of attrOrig) {
      if (el.isConnected) continue;
      for (const attr of Object.keys(store)) el.setAttribute(attr, store[attr]);
      attrOrig.delete(el);
    }
    for (const [el, value] of refOrig) {
      if (el.isConnected) continue;
      el.textContent = value;
      refOrig.delete(el);
    }
    for (const [el, display] of hiddenOrig) {
      if (el.isConnected) continue;
      el.style.display = display;
      hiddenOrig.delete(el);
    }
    for (const [container] of orderOrig) {
      if (!container.isConnected) orderOrig.delete(container);
    }
    for (const [badge, el] of markerOrig) {
      if (badge.isConnected) continue;
      badge.remove();
      el.removeAttribute('data-gs-no-equiv');
      markerOrig.delete(badge);
    }
    for (const [el, display] of profileHiddenOrig) {
      if (el.isConnected) continue;
      if (display) el.style.display = display;
      else el.style.removeProperty('display');
      profileHiddenOrig.delete(el);
    }
    for (const [el, order] of profileOrderOrig) {
      if (el.isConnected) continue;
      if (order) el.style.order = order;
      else el.style.removeProperty('order');
      profileOrderOrig.delete(el);
    }
  }

  /* -------------------------------------------------------------- boot -- */

  // Throttle, not debounce. A trailing debounce is starved on a page that
  // mutates continuously — GitHub's repo page does — so nodes added while the
  // page keeps changing would never be painted. The first mutation schedules a
  // run; anything that arrives while it waits is batched into that run.
  const pending = [];
  const pendingSet = new Set();
  let scheduled = false;

  // Queue a node for the next flush, skipping one an already-queued ancestor
  // will paint anyway. Keeps a large re-render from walking the same subtree
  // once per added child.
  function enqueue(node) {
    if (pendingSet.has(node)) return;
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (pendingSet.has(el)) return;
    }
    pending.push(node);
    pendingSet.add(node);
  }

  function onMutations(records) {
    if (!theme) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) enqueue(node);
        else if (node.nodeType === 3 && node.parentElement) {
          enqueue(node.parentElement);
        }
      }
    }
    if (!pending.length || scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      const batch = pending.splice(0);
      pendingSet.clear();
      if (!theme) return;
      const current = theme;
      // Paint only the top-most node of each added subtree; a queued descendant
      // of an already-painted node has been covered.
      const done = new Set();
      for (const node of batch) {
        if (!node.isConnected) continue;
        let covered = false;
        for (let el = node.parentElement; el; el = el.parentElement) {
          if (done.has(el)) {
            covered = true;
            break;
          }
        }
        if (covered) continue;
        done.add(node);
        paintNode(node, current);
      }
      paintOrder(current);
      paintNavGroups(current);
      paintProfileStats(current);
      paintProfileMenu(current);
      const now = Date.now();
      if (now - lastSweep > 3000) {
        lastSweep = now;
        forgetDetached();
      }
    }, 120);
  }

  /* ------------------------------------------------------- body watching -- */

  const BODY_MUTATIONS = { childList: true, subtree: true };

  // Attached only while a skin is on. On every other page the expensive
  // whole-body childList observer is never created, so the extension stays
  // inert where it has not been set up.
  function watchBody() {
    if (domObserver || !document.body) return;
    domObserver = new MutationObserver(onMutations);
    domObserver.observe(document.body, BODY_MUTATIONS);
  }

  function unwatchBody() {
    if (!domObserver) return;
    domObserver.disconnect();
    domObserver = null;
  }

  function syncTheme() {
    const next = themeOf();
    if (next === theme) return;
    if (theme) revertAll();
    theme = next;
    if (theme) {
      watchBody();
      if (document.body) paintAll(theme);
    } else {
      unwatchBody();
    }
  }

  /* --------------------------------------------------------- shortcuts -- */

  function sendKey(char) {
    const code = char.toUpperCase().charCodeAt(0);
    const event = new KeyboardEvent('keydown', {
      key: char,
      code: `Key${char.toUpperCase()}`,
      keyCode: code,
      which: code,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    Object.defineProperty(event, '__gsUx', { value: true });
    document.dispatchEvent(event);
  }

  function findNavLink(label) {
    for (const region of document.querySelectorAll(UX.NAV_SCOPE)) {
      for (const link of region.querySelectorAll('a')) {
        // labelMatches normalises internal whitespace: a label and its counter
        // can be separate nodes ("Pull requests\n-"), which a plain trim misses.
        if (UX.labelMatches(link.textContent, label)) return link;
      }
    }
    return null;
  }

  function deliver(combo, target) {
    // A click on the site's own navigation link is trusted, so it works even
    // where synthetic key events are ignored (GitLab checks isTrusted). Fall
    // back to replaying the site's own combo for destinations with no link.
    const label = (UX.SHORTCUT_TARGETS[theme] || {})[combo];
    const link = label ? findNavLink(label) : null;
    if (link) link.click();
    else sendKey(target.slice(1));
  }

  function installKeys() {
    keyHandler = (event) => {
      if (!theme || event.__gsUx || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const active = document.activeElement;
      if (
        active &&
        (active.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))
      ) {
        return;
      }
      if (event.key.length !== 1) return;
      const key = event.key.toLowerCase();
      const now = Date.now();
      const combo = gPending && now - gPending < 1200 ? `g${key}` : '';
      gPending = key === 'g' ? now : 0;
      if (!combo) return;
      const target = (UX.SHORTCUTS[theme] || {})[combo];
      if (!target) return;
      // The real `g` already reached the site; swallow this second key and
      // deliver the destination the site's own product would have used.
      event.preventDefault();
      event.stopImmediatePropagation();
      deliver(combo, target);
    };
    document.addEventListener('keydown', keyHandler, true);
  }

  function start() {
    if (classObserver) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }
    // The root observer is cheap and has to exist before the theme can change;
    // the body observer is the expensive one and only runs while a skin is on
    // (see watchBody), so an unclassified page carries neither.
    classObserver = new MutationObserver(syncTheme);
    classObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    installKeys();
    theme = themeOf();
    if (theme) {
      watchBody();
      paintAll(theme);
    }
  }

  start();
})();
