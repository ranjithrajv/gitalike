/**
 * gitalike — UX content script: core.
 *
 * The colour skin is done entirely in CSS; the content scripts carry the part
 * CSS cannot: the words, the reference markers, the app-navigation order and
 * the keyboard combos. It is active only while one of the theme classes is on
 * <html>, and every change it makes is recorded so it can be undone exactly
 * when the skin is switched off.
 *
 *   html.gs-theme-gitlab   a GitHub site -> GitHub words become GitLab's
 *   html.gs-theme-github   a GitLab site -> GitLab words become GitHub's
 *
 * This file owns the shared state (the undo ledger, the theme, the observers)
 * and the utilities every pass uses. The passes themselves live in sibling
 * files, which register into `nodePasses` / `globalPasses` here:
 *
 *   ux-copy.js     copy, attributes and reference markers
 *   ux-nav.js      nav relabel, hide, markers, order and group headings
 *   ux-project.js  metadata, headings, project tabs, Gitea's rebuilt nav
 *   ux-profile.js  the profile rail, stats and menu
 *   ux.js          the entry point, which boots this core
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
 * The tables this reads live in src/lib/ux.js: the vocabulary, the nav order,
 * the shortcuts and — since the forge's markup is the thing most likely to
 * change underneath us — every DOM selector, under `SELECTORS`, keyed by the
 * site's source product. Add a hook there, not here.
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

  // A page can receive these scripts both from the registered content script
  // and from the one-off injection used when its host is added while it is
  // open; only the first builds the runtime. The pass modules guard themselves
  // with `once`, so a second injection cannot register a pass twice.
  if (globalThis.__gitalikeUx) return;
  globalThis.__gitalikeUx = true;

  const SELECTORS = UX.SELECTORS;

  const root = document.documentElement;
  // Which themes exist is derived from the shared `kinds` table, not listed here.
  const THEMES = SITES.THEMES;
  // The shape a skin is built to ('github' top bar + tabs, 'gitlab' sidebar).
  // Structural passes key on this, not the theme name, so a third target
  // (Bitbucket) reuses a layout instead of needing its own copies of every pass.
  const layoutOf = (t) => (SITES.skins[t] && SITES.skins[t].layout) || t;

  const SKIP_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'CODE',
    'PRE',
    'KBD',
    'SAMP',
    'TEXTAREA',
    'INPUT',
    'SELECT',
    'OPTION',
  ]);
  const SKIP_SELECTOR =
    'script,style,noscript,template,code,pre,[contenteditable=""],[contenteditable="true"],[data-gs-ux-skip]';

  let theme = null;
  let domObserver = null;
  let classObserver = null;
  let gPending = 0;
  let keyHandler = null;
  let lastSweep = 0;

  // The detail elements the profile rail is currently hiding, so a rebuild can
  // release exactly the ones it hid before hiding the new set. Shared with
  // ux-profile.js; reassigned (not just mutated) on a revert.
  const rail = { details: new Set() };
  // The profile-menu containers, kept while they are in the page so a flush
  // does not re-scan the document.
  const profileContainerCache = { key: null, list: [] };

  const themeOf = () =>
    THEMES.find((name) => root.classList.contains(`gs-theme-${name}`)) || null;

  /* ------------------------------------------------------- undo ledger -- */

  // Every change the skin makes is recorded here, so a switch-off restores the
  // page exactly and a node the framework has detached can be forgotten before
  // the ledger keeps its subtree alive. One entry per (target, kind); the first
  // entry recorded for a pair is the one kept, so re-painting never overwrites
  // the value captured when the skin first touched the node. That is what makes
  // a new pass a single `ledger(...)` call instead of an edit to the revert
  // walk and to the forget walk as well.
  /** @type {Map<Node, Map<string, {restore: () => void}>>} */
  const undo = new Map();

  /**
   * The ledger entry for (target, kind), built by `make` the first time.
   * @returns {{restore: () => void}}
   */
  function ledger(target, kind, make) {
    let kinds = undo.get(target);
    if (!kinds) {
      kinds = new Map();
      undo.set(target, kinds);
    }
    let entry = kinds.get(kind);
    if (!entry) {
      entry = make();
      kinds.set(kind, entry);
    }
    return entry;
  }

  // Undo one entry and drop it. A pass that has to rebuild a subtree (the
  // profile rail and menu) uses this to release the old nodes before it hides
  // the new ones; the ledger alone could only undo them at switch-off.
  function release(target, kind) {
    const kinds = undo.get(target);
    if (!kinds) return;
    const entry = kinds.get(kind);
    if (!entry) return;
    entry.restore();
    kinds.delete(kind);
    if (!kinds.size) undo.delete(target);
  }

  // Undo every entry of a kind whose target sits inside `root`.
  function releaseWithin(root, kind) {
    for (const [target, kinds] of undo) {
      if (!kinds.has(kind) || !root.contains(target)) continue;
      kinds.get(kind).restore();
      kinds.delete(kind);
      if (!kinds.size) undo.delete(target);
    }
  }

  // Hide an element, recording how to show it again. `important` matches the
  // site's own !important on the elements that need it (the profile card).
  function hide(el, important = false) {
    const display = el.style.display;
    ledger(el, 'display', () => ({
      restore: () => {
        if (display) el.style.display = display;
        else el.style.removeProperty('display');
      },
    }));
    if (important) el.style.setProperty('display', 'none', 'important');
    else if (el.style.display !== 'none') el.style.display = 'none';
  }

  // Set the flex `order` an item now has, recording the original. Kept apart
  // from the nav reorder's kind so the two cannot release each other.
  function setOrder(el, value) {
    const order = el.style.order;
    ledger(el, 'style-order', () => ({
      restore: () => {
        if (order) el.style.order = order;
        else el.style.removeProperty('order');
      },
    }));
    el.style.setProperty('order', value);
  }

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
        if (
          !parent ||
          SKIP_TAGS.has(parent.tagName) ||
          parent.isContentEditable
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!n.nodeValue || !n.nodeValue.trim())
          return NodeFilter.FILTER_REJECT;
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
    const entry = ledger(node, 'text', () => {
      const original = node.nodeValue;
      return {
        original,
        restore: () => {
          node.nodeValue = original;
        },
      };
    });
    return entry.original;
  }

  /* ----------------------------------------------------- pass registry -- */

  // Passes register themselves here. The node passes run per added subtree, the
  // global passes run document-wide after them. Registration order is the load
  // order of the pass modules (see the CONTENT_JS list), and it is the run order
  // — which is why a pass that must read what an earlier one wrote is kept in a
  // module loaded after it.
  const nodePasses = [];
  const globalPasses = [];
  const loaded = new Set();

  // Run `fn` once per document. The one-off injection adds every content script
  // again; without this a pass would register twice and paint twice.
  function once(key, fn) {
    if (loaded.has(key)) return;
    loaded.add(key);
    fn();
  }

  function paintNode(node, t) {
    for (const pass of nodePasses) pass(node, t);
  }

  function paintGlobal(t) {
    for (const pass of globalPasses) pass(t);
  }

  function paintAll(t, node = document.body) {
    if (!node) return;
    paintNode(node, t);
    paintGlobal(t);
  }

  /* ------------------------------------------------------------- revert -- */

  function revertAll() {
    for (const kinds of undo.values()) {
      for (const entry of kinds.values()) entry.restore();
    }
    undo.clear();
    rail.details = new Set();
    // Nodes the skin created are removed outright: they have no earlier state
    // to restore, so they are not in the ledger.
    for (const el of document.querySelectorAll(
      '.gs-nav-group,[data-gs-profile-stats],[data-gs-profile-menu],' +
        '[data-gs-profile-rail],[data-gs-project-tabs],[data-gs-gitea-nav],' +
        '[data-gs-gitea-added]',
    )) {
      el.remove();
    }
    for (const el of document.querySelectorAll('[data-gs-active]')) {
      el.removeAttribute('data-gs-active');
    }
    profileContainerCache.key = null;
    profileContainerCache.list = [];
  }

  // Drop the entries the framework has discarded, so the ledger cannot hold a
  // detached subtree alive. A node is restored before it is forgotten: if the
  // site later re-attaches it, it comes back with the site's own text and the
  // normal paint records it again, so a revert stays exact.
  function forgetDetached() {
    for (const [target, kinds] of undo) {
      if (target.isConnected) continue;
      for (const entry of kinds.values()) entry.restore();
      undo.delete(target);
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
      paintGlobal(current);
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

  const watching = () => Boolean(domObserver);

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
      if (
        !theme ||
        event.__gsUx ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
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
      // The remap translates *between* GitHub's and GitLab's combos. On a forge
      // that is neither (Gitea), replaying the other product's combo would break
      // the key the site actually implements, so its own shortcuts are left
      // alone. `source` is set by content/theme.js from the shared tables.
      const expectedSource = theme === 'github' ? 'gitlab' : 'github';
      if (root.dataset.gsSource && root.dataset.gsSource !== expectedSource)
        return;
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
    classObserver.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });
    installKeys();
    theme = themeOf();
    if (theme) {
      watchBody();
      paintAll(theme);
    }
  }

  // The surface the pass modules use. Kept deliberately small: the passes own
  // their own logic, this owns the shared state they mutate and the order they
  // run in.
  globalThis.GITALIKE_UX_RUNTIME = {
    UX,
    SELECTORS,
    layoutOf,
    ledger,
    release,
    releaseWithin,
    hide,
    setOrder,
    scope,
    walkText,
    textNodes,
    rememberText,
    watchBody,
    unwatchBody,
    watching,
    rail,
    profileContainerCache,
    nodePasses,
    globalPasses,
    once,
    start,
  };
})();
