/**
 * Git Same — content script.
 *
 * Runs on http(s) pages at `document_start`. It never touches page structure;
 * all it does is keep two classes on <html> in sync:
 *
 *   html.gs-theme-gitlab   a GitHub-flavoured site, skinned as GitLab
 *   html.gs-theme-github   a GitLab-flavoured site, skinned as GitHub
 *   html.gs-dark           ...and the site is currently in dark mode
 *
 * Both stylesheets are injected on every page by the manifest; which one shows
 * is decided purely by these classes, so the extension is inert everywhere the
 * user has not set a site up.
 */
(() => {
  'use strict';

  const api = globalThis.browser ?? globalThis.chrome;
  if (!api?.storage?.sync) return;

  const SITES = globalThis.GIT_SAME;
  if (!SITES) return;

  const SETTINGS_KEY = 'gitSameSettings';
  const INSTANCES_KEY = 'gitSameInstances';
  const CACHE_KEY = 'gitSame.theme';
  const THEMES = ['gitlab', 'github'];

  const root = document.documentElement;
  const host = location.hostname;

  /* ---------------------------------------------------------------- mode -- */

  /** @param {'gitlab'|'github'|null} theme */
  function apply(theme) {
    for (const name of THEMES) root.classList.toggle(`gs-theme-${name}`, name === theme);
    syncDark();
  }

  function remember(theme) {
    // localStorage is per-origin, so this is a cache for *this* host. It is the
    // only store readable synchronously at document_start, which is what makes
    // the first paint correct on repeat visits.
    try {
      localStorage.setItem(CACHE_KEY, theme || '');
    } catch {
      /* private mode, disabled storage — the async path still works */
    }
  }

  async function reconcile() {
    const stored = await api.storage.sync.get([SETTINGS_KEY, INSTANCES_KEY]);
    const theme = SITES.themeFor(
      host,
      stored?.[SETTINGS_KEY],
      stored?.[INSTANCES_KEY],
    );
    remember(theme);
    apply(theme);
  }

  /* ----------------------------------------------------------- dark mode -- */

  // GitHub states its mode in `data-color-mode`; GitLab toggles `.gl-dark`.
  // Fall back to the computed `color-scheme`, then to the OS preference.
  const prefersDark = matchMedia('(prefers-color-scheme: dark)');
  let dark = null;

  function detectDark() {
    const mode = root.getAttribute('data-color-mode');
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    // GitHub's "sync with system" setting. It resolves from the OS, so ask the
    // OS directly. Falling through to the computed `color-scheme` here would be
    // wrong: our own palette sets that property, so we would end up reading
    // back our own answer instead of the site's.
    if (mode === 'auto') return prefersDark.matches;
    // GitLab states its own mode explicitly with one of three classes:
    // gl-dark, gl-light, or gl-system (follow the OS — which is what the
    // fallback below already does). Honouring only gl-dark meant an explicitly
    // *light* GitLab on a dark desktop got skinned dark.
    const has = (name) =>
      root.classList.contains(name) ||
      Boolean(document.body && document.body.classList.contains(name));
    if (has('gl-dark')) return true;
    if (has('gl-light')) return false;
    // Last resort, for anything that advertises its mode only this way.
    const scheme = getComputedStyle(root).colorScheme || '';
    if (scheme.includes('dark') && !scheme.includes('light')) return true;
    if (scheme.includes('light') && !scheme.includes('dark')) return false;
    return prefersDark.matches;
  }

  function syncDark() {
    const next = detectDark();
    if (next === dark) return;
    dark = next;
    root.classList.toggle('gs-dark', next);
  }

  /* ---------------------------------------------------------------- boot -- */

  // 1. Paint the cached decision synchronously, so a repeat visit never flashes
  //    the original theme.
  apply(localStorage.getItem(CACHE_KEY) || null);

  // 2. Reconcile against storage. On a host that has just been set up this is
  //    the only thing that knows about it, so it has to run even when the cache
  //    says "off"; writes to storage only reach already-open tabs.
  reconcile().catch(() => {});

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes[SETTINGS_KEY] && !changes[INSTANCES_KEY]) return;
    reconcile().catch(() => {});
  });

  /* -------------------------------------------------------- mode watching -- */

  // `class` covers GitLab's .gl-dark; `data-color-mode` covers GitHub's
  // in-page theme switcher. Our own class writes land here too, but syncDark()
  // short-circuits when nothing changed, so there is no loop.
  new MutationObserver(syncDark).observe(root, {
    attributes: true,
    attributeFilter: ['class', 'data-color-mode'],
  });

  prefersDark.addEventListener('change', syncDark);
  syncDark();
})();
