/**
 * GitAlike — UX content script: copy, attributes and reference markers.
 *
 * Node passes: they run over each added subtree, so they are cheap to re-run.
 * See ux-core.js for the shared runtime and ux.js for the entry point.
 */
(() => {
  'use strict';

  const rt = globalThis.GITALIKE_UX_RUNTIME;
  if (!rt) return;
  const { UX, ledger, scope, walkText, rememberText } = rt;

  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const ATTR_SELECTOR = ATTRS.map((a) => `[${a}]`).join(',');
  const REF_SELECTOR =
    'a[href*="/pull/"],a[href*="/pulls/"],a[href*="/pull-requests/"],a[href*="/merge_requests/"]';

  // Copy and control labels in one traversal. Inside a control (UX.LABEL_SCOPE)
  // the *original* whole label is matched first, so a label that also contains a
  // phrase ("Merge pull request") gets its exact word ("Merge") rather than being
  // mangled by phrase translation first. Everything else is phrase-translated.
  function paintCopy(node, t) {
    walkText(node, (text, isControl) => {
      const original = rememberText(text);
      const value = isControl
        ? (UX.controlLabel(original.trim(), t) ?? UX.translate(original, t))
        : UX.translate(original, t);
      if (value !== text.nodeValue) text.nodeValue = value;
    });
  }

  function paintAttrs(node, t) {
    for (const el of scope(node, ATTR_SELECTOR)) {
      const entry = ledger(el, 'attrs', () => {
        const values = {};
        return {
          values,
          restore: () => {
            for (const attr of Object.keys(values)) {
              el.setAttribute(attr, values[attr]);
            }
          },
        };
      });
      for (const attr of ATTRS) {
        if (!el.hasAttribute(attr)) continue;
        if (!(attr in entry.values)) entry.values[attr] = el.getAttribute(attr);
        const next = UX.translate(entry.values[attr], t);
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
      ledger(anchor, 'ref', () => {
        const original = anchor.textContent;
        return {
          restore: () => {
            anchor.textContent = original;
          },
        };
      });
      if (current !== marker) anchor.textContent = marker;
    }
  }

  rt.once('copy', () => {
    rt.nodePasses.push(paintCopy, paintAttrs, paintRefs);
  });
})();
