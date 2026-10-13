/**
 * GitAlike — Gerrit shadow-DOM opener.
 *
 * PolyGerrit renders its entire app inside closed shadow roots. The UX content
 * script cannot reach inside a closed shadow root to rewrite text or
 * navigation, so Gerrit's page copy and nav labels inside the app are never
 * relabelled to the applied product's words.
 *
 * This script runs at `document_start` on Gerrit hosts only, before
 * PolyGerrit's bundle executes. It monkey-patches `Element.prototype.attachShadow`
 * to force `open` mode on every shadow root created on the page, so the UX
 * script's `querySelectorAll` can descend into them. The patch is scoped to
 * the Gerrit host (checked by `data-gs-source="gerrit"` on `<html>`, which
 * `theme.js` sets before this runs) and is idempotent — a second injection
 * cannot double-patch.
 *
 * The trade-off: forced-open shadow roots are inspectable by any script on the
 * page. That is acceptable here because (1) the extension already has full
 * content-script access to the page, (2) the patch only applies to Gerrit
 * hosts the user has explicitly configured, and (3) the alternative — leaving
 * the shadow roots closed — means the skin cannot reach Gerrit's own text.
 */
(() => {
  'use strict';

  // Only run on Gerrit pages. `theme.js` sets this attribute before the UX
  // scripts load, and this script is only registered for Gerrit hosts.
  if (document.documentElement.dataset.gsSource !== 'gerrit') return;

  // Idempotent: a second injection must not double-patch.
  if (globalThis.__gitalikeShadowOpened) return;
  globalThis.__gitalikeShadowOpened = true;

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function attachShadow(init) {
    // Force open mode so the UX content script can query inside.
    return originalAttachShadow.call(this, {
      ...init,
      mode: 'open',
    });
  };
})();
