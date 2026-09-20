/**
 * Git Same — UX content script.
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

  const UX = globalThis.GIT_SAME_UX;
  if (!UX || typeof document === 'undefined') return;

  const root = document.documentElement;
  const THEMES = ['gitlab', 'github'];

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

  let theme = null;
  let applying = false;
  let domObserver = null;
  let classObserver = null;
  let debounce = 0;
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
      badge.setAttribute('aria-hidden', 'true');
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
    // anchors and buttons inside them.
    for (const region of scope(node, UX.NAV_SCOPE)) {
      for (const el of scope(region, 'a,button,summary')) {
        const label = (el.textContent || '').trim();
        if (!Object.prototype.hasOwnProperty.call(map, label)) continue;
        for (const text of textNodes(el)) {
          if (text.nodeValue.trim() === label) {
            rememberText(text);
            if (text.nodeValue !== map[label]) text.nodeValue = map[label];
            break;
          }
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
        const items = [...el.children].filter((c) => c.matches(rule.item));
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
      const items = children.filter((c) => c.matches(rule.item));
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

  function paintAll(t, node = document.body) {
    if (!node) return;
    applying = true;
    paintText(node, t);
    paintAttrs(node, t);
    paintRefs(node, t);
    paintControls(node, t);
    paintNav(node, t);
    paintUnmapped(node, t);
    paintOrder(t);
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
    textOrig.clear();
    attrOrig.clear();
    refOrig.clear();
    orderOrig.clear();
    markerOrig.clear();
  }

  /* -------------------------------------------------------------- boot -- */

  function onMutations(records) {
    if (!theme || applying) return;
    const added = [];
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType === 1) added.push(node);
        else if (node.nodeType === 3 && node.parentElement) added.push(node.parentElement);
      }
    }
    if (!added.length) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (!theme) return;
      const current = theme;
      applying = true;
      for (const node of added) {
        if (!node.isConnected) continue;
        paintText(node, current);
        paintAttrs(node, current);
        paintRefs(node, current);
        paintControls(node, current);
        paintNav(node, current);
        paintUnmapped(node, current);
      }
      applying = false;
      paintOrder(current);
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
