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

  let theme = null;
  let applying = false;
  let domObserver = null;
  let classObserver = null;
  let gPending = 0;
  let keyHandler = null;

  const themeOf = () =>
    THEMES.find((name) => root.classList.contains(`gs-theme-${name}`)) || null;

  /* ---------------------------------------------------------- utilities -- */

  function scope(node, selector) {
    const out = [];
    if (!node) return out;
    if (node.nodeType === 1 && node.matches(selector)) out.push(node);
    if (node.querySelectorAll) out.push(...node.querySelectorAll(selector));
    return out;
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

  function paintText(node, t) {
    for (const text of textNodes(node)) {
      const original = rememberText(text);
      const next = UX.translate(original, t);
      if (next !== text.nodeValue) text.nodeValue = next;
    }
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

  function paintControls(node, t) {
    for (const control of scope(node, UX.LABEL_SCOPE)) {
      for (const text of textNodes(control)) {
        const label = text.nodeValue.trim();
        const next = UX.translateControl(label, t);
        if (next === label) continue;
        rememberText(text);
        if (text.nodeValue !== next) text.nodeValue = next;
      }
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

  function paintOrder(t) {
    for (const rule of UX.NAV_RULES[t] || []) {
      const container = resolveContainer(rule);
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
      if (domObserver) domObserver.disconnect();
      for (const child of next) container.appendChild(child);
      if (domObserver) {
        domObserver.observe(document.body, { childList: true, subtree: true });
      }
    }
  }

  // Insert GitLab-style group headings into the (now ordered) sidebar. Runs
  // after paintOrder so the headings land on the final order, and rebuilds only
  // when the headings no longer match — otherwise our own insertions would feed
  // back through the mutation observer.
  function paintNavGroups(t) {
    if (!UX.NAV_GROUPS[t]) return;
    for (const region of document.querySelectorAll(UX.NAV_SCOPE)) {
      const ul = region.querySelector('ul.UnderlineNav-body');
      if (!ul) continue;
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
      if (ok) continue;
      for (const el of current) el.remove();
      for (const entry of desired) {
        const heading = document.createElement('li');
        heading.className = 'gs-nav-group';
        heading.setAttribute('data-gs-ux-skip', '');
        heading.textContent = entry.group;
        ul.insertBefore(heading, entry.before);
      }
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
      ['Organizations', `/users/${u}/groups`, 'Groups'],
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

  function paintProfileMenu(t) {
    const build = PROFILE_MENU[t];
    if (!build || !document.body) return;

    // GitHub's card has no "About"/"Info"/"Contact" headings; GitLab's card
    // does, so they are dropped rather than left as foreign labels.
    if (t === 'github') {
      for (const heading of document.querySelectorAll('.user-profile-sidebar h2')) {
        const text = (heading.textContent || '').trim();
        if (text === 'About' || text === 'Info' || text === 'Contact') {
          hideProfileItem(heading);
        }
      }
    }

    const sourceIsGitlab = t === 'github';
    const containers = sourceIsGitlab
      ? [...document.querySelectorAll('.super-sidebar .gl-scroll-scrim ul')]
      : [...document.querySelectorAll('nav[aria-label="User profile"]')];
    if (!containers.length) return;

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
    paintText(node, t);
    paintAttrs(node, t);
    paintRefs(node, t);
    paintControls(node, t);
    paintNav(node, t);
    paintNavHide(node, t);
    paintUnmapped(node, t);
  }

  function paintAll(t, node = document.body) {
    if (!node) return;
    applying = true;
    paintNode(node, t);
    paintOrder(t);
    paintNavGroups(t);
    paintProfileStats(t);
    paintProfileMenu(t);
    applying = false;
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
  }

  /* -------------------------------------------------------------- boot -- */

  // Throttle, not debounce. A trailing debounce is starved on a page that
  // mutates continuously — GitHub's repo page does — so nodes added while the
  // page keeps changing would never be painted. The first mutation schedules a
  // run; anything that arrives while it waits is batched into that run.
  const pending = [];
  let scheduled = false;

  function onMutations(records) {
    if (!theme) return;
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) pending.push(node);
        else if (node.nodeType === 3 && node.parentElement) {
          pending.push(node.parentElement);
        }
      }
    }
    if (!pending.length || scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      const batch = pending.splice(0);
      if (!theme) return;
      const current = theme;
      applying = true;
      for (const node of batch) {
        if (node.isConnected) paintNode(node, current);
      }
      applying = false;
      paintOrder(current);
      paintNavGroups(current);
      paintProfileStats(current);
      paintProfileMenu(current);
    }, 120);
  }

  function syncTheme() {
    const next = themeOf();
    if (next === theme) return;
    if (theme) revertAll();
    theme = next;
    if (theme && document.body) paintAll(theme);
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
    if (domObserver) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', start, { once: true });
      return;
    }
    // Observers first, so the very first paint can already disconnect/reconnect
    // around its own navigation reorder.
    domObserver = new MutationObserver(onMutations);
    domObserver.observe(document.body, { childList: true, subtree: true });
    classObserver = new MutationObserver(syncTheme);
    classObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
    installKeys();
    theme = themeOf();
    if (theme) paintAll(theme);
  }

  start();
})();
