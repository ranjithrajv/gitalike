/**
 * What GitAlike knows about hosts, the skins it applies, and the storage schema
 * it reads them from.
 *
 * Loaded as a plain script by the content script, the popup and the background
 * context, so the tables cannot drift between them.
 *
 * The manifest grants only the bundled hosts rather than the whole web. That is
 * not laziness — GitHub Enterprise Server and self-hosted GitLab sit on hostnames
 * nobody can predict ahead of time (`github.acme.com`, `code.corp.example`,
 * sometimes no `github.` prefix at all), and a manifest match pattern cannot
 * wildcard a host's middle. A self-hosted instance is granted one origin at a
 * time from the popup's Add a site click (`optional_host_permissions`), so
 * deciding at runtime is what lets an arbitrary instance work with no rebuild;
 * see CONTRIBUTING.md.
 */
(() => {
  'use strict';

  /** Hosts bundled with the extension. These cannot be removed. */
  const builtin = {
    'github.com': 'github',
    'gitlab.com': 'gitlab',
    // GitHub-flavoured forges: they speak GitHub's dialect, so they are the
    // 'github' kind and are shown with the GitLab UI. Codeberg runs Forgejo and
    // gitea.com runs Gitea; both are Gitea's markup, so themes/as-gitlab.css
    // carries a token block for them (see "Gitea / Forgejo").
    'codeberg.org': 'github',
    'gitea.com': 'github',
    // Bitbucket is a source product as well as a target: a Bitbucket host can
    // wear the GitHub or GitLab UI. Its markup is its own, so a Bitbucket site
    // wearing the Bitbucket UI is its own UI (a no-op), the same way GitHub is.
    'bitbucket.org': 'bitbucket',
  };

  /**
   * Every skin the extension can paint, keyed by the product whose UI it is.
   * A kind names the skin it wears by default; the popup lists these so a site
   * can be shown with any of them. A site wearing its own UI is left alone (see
   * `themeFor`), so only the other product's skin actually repaints it.
   *
   * `layout` is the shape the skin is built to: `github` is a top bar plus a
   * horizontal tab row, `gitlab` is a left sidebar. It is not the source the
   * skin is applied to — Bitbucket reuses GitLab's sidebar on any source — so
   * the structural passes key on this rather than on the theme name.
   */
  const skins = {
    gitlab: {
      product: 'GitLab',
      badge: 'GL',
      color: '#7759c2',
      layout: 'gitlab',
    },
    github: {
      product: 'GitHub',
      badge: 'GH',
      color: '#24292f',
      layout: 'github',
    },
    bitbucket: {
      product: 'Bitbucket',
      badge: 'BB',
      color: '#0052cc',
      // Bitbucket's repo navigation is a left sidebar (its own state marks the
      // navigation "open" and sends no horizontal items), so it reuses GitLab's
      // layout rather than GitHub's.
      layout: 'gitlab',
    },
  };

  /**
   * A "kind" is which product a site is. Its `theme` is the skin applied by
   * default — the *other* product's. The setting that drives the default is the
   * kind's own key, so it is not repeated here; a per-host choice can override
   * the default with any skin in `skins`.
   */
  const kinds = {
    github: { theme: 'gitlab' },
    gitlab: { theme: 'github' },
    // Bitbucket and Gerrit are sources too. There is no single "other" product
    // for a third or fourth kind, so they default to the GitHub UI; the popup
    // can pick either.
    bitbucket: { theme: 'github' },
    gerrit: { theme: 'github' },
  };

  const isKind = (value) => Object.hasOwn(kinds, value);

  /**
   * The storage keys GitAlike owns, kept beside the schema that gives them
   * meaning (the `settings` map is keyed by kind, the `instances` map by host,
   * the `hostSettings` map by host). Every context reads the same triple through
   * `stateFrom`.
   */
  const SETTINGS_KEY = 'gitSameSettings';
  const INSTANCES_KEY = 'gitSameInstances';
  const HOST_SETTINGS_KEY = 'gitSameHostSettings';
  const STORAGE_KEYS = [SETTINGS_KEY, INSTANCES_KEY, HOST_SETTINGS_KEY];

  /**
   * Every skin name, derived from `skins` so a new skin is listed exactly once.
   * @type {string[]}
   */
  const THEMES = Object.keys(skins);

  /**
   * The three stored maps with their defaults applied, and the one-skin rule
   * enforced (at most one kind is on). Takes the raw result of
   * `storage.sync.get(STORAGE_KEYS)` so that the defaults live in one place.
   * @returns {{settings: object, instances: object, hostSettings: object}}
   */
  // Only a plain object is a usable map. Synced storage is user data and could
  // hold anything; a string or array would otherwise be iterated key by key (and
  // a primitive would throw when the background writes back to it).
  function plainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function stateFrom(stored) {
    const settings = plainObject(stored?.[SETTINGS_KEY])
      ? { ...stored[SETTINGS_KEY] }
      : {};
    // Exactly one skin is active at a time: the popup writes the chosen skin to
    // every kind, so two kinds holding different skins is a state from the
    // older per-kind model. Collapse it here, deterministically, to the first
    // kind's skin, so every reader (background, content script, popup) agrees
    // instead of each picking whichever key it happens to read first. Cloned,
    // not written back: storage is only normalised on read.
    const chosen = Object.keys(kinds)
      .map((kind) => settings[kind])
      .filter((value) => THEMES.includes(value));
    if (new Set(chosen).size > 1) {
      for (const kind of Object.keys(kinds)) settings[kind] = chosen[0];
    }
    return {
      settings,
      instances: plainObject(stored?.[INSTANCES_KEY])
        ? stored[INSTANCES_KEY]
        : {},
      hostSettings: plainObject(stored?.[HOST_SETTINGS_KEY])
        ? stored[HOST_SETTINGS_KEY]
        : {},
    };
  }

  /**
   * The kind a host belongs to: bundled table first, then whatever the user
   * added. `added` is the stored `gitSameInstances` map.
   * @returns {'github'|'gitlab'|null} null means "not set up yet"
   */
  function kindFor(host, added) {
    if (isKind(builtin[host])) return builtin[host];
    const entry = added && added[host];
    return isKind(entry) ? entry : null;
  }

  /**
   * The markup and token family a host is built on. Normally this is its kind,
   * but a GitHub-flavoured forge (Gitea/Forgejo) does not use GitHub's markup or
   * Primer tokens, so showing it with the GitHub UI is a real skin rather than a
   * no-op. Only the bundled forges differ this way; a user-added self-hosted
   * instance is assumed to be built on its product's markup.
   */
  const SOURCES = {
    'codeberg.org': 'gitea',
    'gitea.com': 'gitea',
  };

  function sourceFor(host, added) {
    if (Object.prototype.hasOwnProperty.call(SOURCES, host))
      return SOURCES[host];
    return kindFor(host, added);
  }

  // A bare hostname — no scheme, port, path, query, whitespace or wildcard — is
  // the only shape that is safe to hand to `scripting.registerContentScripts`
  // as a match pattern. The instances map is synced user data and could hold
  // anything, so a key that is not a bare host is ignored rather than turned
  // into a pattern (a `*` key would otherwise re-broaden injection to all sites).
  const HOSTNAME_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
  // Keys that are valid-looking hostnames but name an object property, so a
  // stored entry could confuse a prototype-key lookup. No real host uses them.
  const RESERVED_HOSTS = new Set(['__proto__', 'constructor', 'prototype']);
  function isHostname(value) {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 253 &&
      !RESERVED_HOSTS.has(value) &&
      HOSTNAME_RE.test(value)
    );
  }

  /** Every host of a kind: the bundled ones, then the user's, in that order. */
  function hostsFor(kind, added) {
    const hosts = Object.keys(builtin).filter((host) => builtin[host] === kind);
    const extra = added || {};
    for (const host of Object.keys(extra)) {
      if (
        extra[host] === kind &&
        isHostname(host) &&
        hosts.indexOf(host) === -1
      ) {
        hosts.push(host);
      }
    }
    return hosts;
  }

  function isBuiltin(host) {
    return Object.prototype.hasOwnProperty.call(builtin, host);
  }

  /**
   * Normalise what someone types or pastes into a bare hostname.
   *
   * Accepts a bare host, a full URL, a URL with a path or port, mixed case and
   * stray whitespace — `https://GitHub.Acme.com/pulls?q=1` and `github.acme.com`
   * both come back as `github.acme.com`. Only the hostname is kept, because a
   * port or path would never match `location.hostname`.
   *
   * @returns {string|null} the hostname, or null if it is not usable
   */
  function parseHost(value) {
    const raw = String(
      value === undefined || value === null ? '' : value,
    ).trim();
    if (!raw) return null;

    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    // Without a scheme, insist on something host-shaped before guessing https.
    if (!hasScheme && !/^[\w.-]+(:\d+)?([/?#]|$)/.test(raw)) return null;

    let url;
    try {
      url = new URL(hasScheme ? raw : `https://${raw}`);
    } catch {
      return null;
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // A trailing dot is a valid FQDN form but never matches location.hostname.
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return hostname || null;
  }

  /**
   * Does this kind's hosts have a skin chosen? The setting under the kind's own
   * key holds any theme from `skins` (or `'off'`), which is what lets a target
   * that no kind defaults to — Bitbucket — be chosen for a whole kind. `themeFor`
   * decides whether that skin actually repaints, or is the host's own UI.
   */
  function kindOn(kind, settings) {
    const meta = kinds[kind];
    return (
      Boolean(meta) && Boolean(settings) && THEMES.includes(settings[kind])
    );
  }

  /**
   * The skin a single host has explicitly chosen: a theme name, `'off'`, or null
   * when the host follows its product switch. This is what lets one enterprise
   * instance wear a different skin (or none) without touching every host of the
   * product. The host is a `location.hostname` or a key the popup just wrote, so
   * only a known theme or the literal `'off'` counts; anything else falls back to
   * the product switch.
   * @returns {string|null} a theme name, 'off', or null
   */
  function hostSkinFor(host, hostSettings) {
    if (
      !hostSettings ||
      !Object.prototype.hasOwnProperty.call(hostSettings, host)
    ) {
      return null;
    }
    const value = hostSettings[host];
    if (value === 'off') return 'off';
    return THEMES.includes(value) ? value : null;
  }

  /** The theme to apply for this host — 'gitlab', 'github', or null for none. */
  function themeFor(host, settings, added, hostSettings) {
    const kind = kindFor(host, added);
    if (!kind) return null;
    const chosen = hostSkinFor(host, hostSettings);
    if (chosen === 'off') return null;
    const wanted = chosen || (kindOn(kind, settings) ? settings[kind] : null);
    if (!wanted) return null;
    // A skin for the site's *own markup* is a no-op — it is already that UI, and
    // repainting it as itself would run the wrong vocabulary and shortcut tables.
    // Gitea is not GitHub's markup, though, so the GitHub UI is a real skin there.
    return wanted === sourceFor(host, added) ? null : wanted;
  }

  /**
   * The one skin the extension is painting — a theme name, or `'off'`. The
   * settings hold the same value under every kind (see `settingsForSkin`), so
   * this is that value; kept beside `kindOn` so a caller does not re-derive the
   * rule from the raw map.
   */
  function globalSkin(settings) {
    if (!settings) return 'off';
    for (const kind of Object.keys(kinds)) {
      if (THEMES.includes(settings[kind])) return settings[kind];
    }
    return 'off';
  }

  /** The settings that select one skin for every kind. */
  function settingsForSkin(theme) {
    const value = theme === 'off' ? 'off' : theme;
    const next = {};
    for (const kind of Object.keys(kinds)) next[kind] = value;
    return next;
  }

  /**
   * Every configured host a theme actually repaints: the host's own markup is
   * not already that UI. So the GitHub UI lists the GitLab hosts and Gitea,
   * while Bitbucket — which is no source's own markup — lists them all.
   */
  function hostsForSkin(theme, added) {
    if (theme === 'off') return [];
    const hosts = [];
    for (const kind of Object.keys(kinds)) {
      for (const host of hostsFor(kind, added)) {
        if (sourceFor(host, added) !== theme) hosts.push(host);
      }
    }
    return hosts;
  }

  globalThis.GITALIKE = {
    kinds,
    skins,
    THEMES,
    SETTINGS_KEY,
    INSTANCES_KEY,
    HOST_SETTINGS_KEY,
    STORAGE_KEYS,
    stateFrom,
    isKind,
    kindFor,
    hostsFor,
    isBuiltin,
    isHostname,
    parseHost,
    kindOn,
    hostSkinFor,
    sourceFor,
    themeFor,
    globalSkin,
    settingsForSkin,
    hostsForSkin,
  };
})();
