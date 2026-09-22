/**
 * GitAlike — UX content script: app navigation.
 *
 * Relabels nav items, hides the ones the applied product has no page for, marks
 * the ones with no counterpart, reorders a flat list, and inserts GitLab's group
 * headings. See ux-core.js for the shared runtime and ux.js for the entry point.
 */
(() => {
  'use strict';

  const rt = globalThis.GITALIKE_UX_RUNTIME;
  if (!rt) return;
  const {
    UX,
    ledger,
    hide,
    scope,
    textNodes,
    rememberText,
    watchBody,
    unwatchBody,
    watching,
  } = rt;

  // A NAV_RULES rule resolves to one container; keep it while that container is
  // still in the page so later mutation flushes do not re-scan the document.
  const navContainer = new WeakMap();
  // The last time each nav container was reordered, so a framework that
  // re-renders its list cannot make the two of us thrash.
  const orderStamp = new WeakMap();
  // How long a container is left alone after a reorder.
  const REORDER_COOLDOWN_MS = 1000;

  // The nav controls inside the nav regions: the anchors, buttons and summaries
  // the relabel, hide and marker passes all walk. One traversal, one selector.
  function navControls(node) {
    const out = [];
    for (const region of scope(node, UX.NAV_SCOPE)) {
      for (const el of scope(region, 'a,button,summary')) out.push(el);
    }
    return out;
  }

  // Hide the items the applied product has no page for, so the menu is the
  // applied product's menu rather than a mix of both. Runs before paintUnmapped
  // so it sees the clean label, not one with a badge on it.
  function paintNavHide(node, t) {
    const keep = UX.NAV_KEEP[t];
    const hideList = UX.NAV_HIDE[t];
    if (!keep && !hideList) return;
    const seenHref = new Set();
    for (const el of navControls(node)) {
      const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
      // A feature the applied product has no counterpart for is marked, not
      // hidden: leave it for paintUnmapped so the page says the feature is not
      // available here instead of dropping it silently. Everything else that
      // has no slot in the applied product's menu is still hidden.
      if (UX.noEquivalentFor(label, t)) continue;
      // A whitelist means "show only the applied product's own options";
      // otherwise hide the ones it has no page for.
      let drop = keep ? !UX.navKeep(label, t) : UX.navHidden(label, t);
      // GitLab lists some destinations twice (pinned and in a group); GitHub's
      // bar lists each once.
      const href = el.getAttribute('href');
      if (!drop && href) {
        if (seenHref.has(href)) drop = true;
        else seenHref.add(href);
      }
      if (!drop) continue;
      // A group toggle is a button whose `li` holds the group's items; hiding
      // the `li` would take the items with it, so only the button goes.
      hide(el.tagName === 'BUTTON' ? el : el.closest('li') || el);
    }
  }

  // The global top bar keeps the source product's marketing words. The applied
  // product's own bar shares the top-level words it uses ("Platform",
  // "Solutions", "Resources", "Pricing"), so only the words it does not carry
  // are hidden — there is no counterpart to translate a marketing link to, and
  // hiding is what keeps the bar reading as the applied product rather than a
  // mix. Whole-label match inside the top bar, so an "Enterprise" in page prose
  // is untouched.
  function paintTopBarHide(node, t) {
    const labels = UX.TOPBAR_HIDE[t];
    if (!labels) return;
    for (const region of scope(node, UX.TOPBAR_SCOPE)) {
      for (const el of scope(region, 'a,button,summary')) {
        const label = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!labels.includes(label)) continue;
        hide(el.closest('li') || el);
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
      ledger(badge, 'marker', () => ({
        restore: () => {
          if (badge.isConnected) badge.remove();
          if (el.isConnected) el.removeAttribute('data-gs-no-equiv');
        },
      }));
      el.appendChild(badge);
      el.setAttribute('data-gs-no-equiv', missing);
    };
    for (const el of navControls(node)) mark(el);
    for (const el of scope(node, UX.LABEL_SCOPE)) mark(el);
  }

  function paintNav(node, t) {
    const map = UX.NAV[t] || {};
    // The labels live on the anchors and buttons inside the nav regions.
    // Matching per text node (not the whole control) is what lets a label with
    // a counter — "Work items -", where the dash is a separate node — still be
    // relabelled.
    for (const el of navControls(node)) {
      for (const text of textNodes(el)) {
        const label = text.nodeValue.trim();
        if (!Object.prototype.hasOwnProperty.call(map, label)) continue;
        rememberText(text);
        if (text.nodeValue !== map[label]) text.nodeValue = map[label];
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
      const next = children.map((child) =>
        itemSet.has(child) ? sorted[slot++] : child,
      );
      if (next.every((child, i) => child === children[i])) continue;
      // A framework that re-renders its list would undo this and, if we kept
      // re-applying, would thrash. Reorder once, then leave it be for a moment.
      const now = Date.now();
      if (
        orderStamp.has(container) &&
        now - orderStamp.get(container) < REORDER_COOLDOWN_MS
      )
        continue;
      orderStamp.set(container, now);
      ledger(container, 'dom-order', () => ({
        restore: () => {
          if (container.isConnected) {
            for (const el of children) container.appendChild(el);
          }
        },
      }));
      // One replaceChildren instead of a re-append per child: fewer layout
      // passes, and the observer never sees the intermediate order.
      const wasWatching = watching();
      if (wasWatching) unwatchBody();
      container.replaceChildren(...next);
      if (wasWatching) watchBody();
    }
  }

  // Insert GitLab-style group headings into the (now ordered) sidebar. Only the
  // GitLab skin groups its menu; GitHub and Bitbucket are flat, and `NAV_GROUPS`
  // is keyed by skin so they get no headings. Runs after paintOrder so the
  // headings land on the final order, and rebuilds only when the headings no
  // longer match — otherwise our own insertions would feed back through the
  // mutation observer.
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

  rt.once('nav', () => {
    rt.nodePasses.push(paintNav, paintNavHide, paintTopBarHide, paintUnmapped);
    rt.globalPasses.push(paintOrder, paintNavGroups);
  });
})();
