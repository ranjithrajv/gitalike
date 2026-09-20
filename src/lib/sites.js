/**
 * What gitalike knows about hosts, the skins it applies, and the storage schema
 * it reads them from.
 *
 * Loaded as a plain script by the content script, the popup and the background
 * context, so the tables cannot drift between them.
 *
 * The manifest matches the whole web rather than a host list. That is not
 * laziness — GitHub Enterprise Server and self-hosted GitLab sit on hostnames
 * nobody can predict ahead of time (`github.acme.com`, `code.corp.example`,
 * sometimes no `github.` prefix at all), and a manifest match pattern cannot
 * wildcard a host's middle. Deciding at runtime is what lets an arbitrary
 * instance work with no permission prompt and no rebuild. The cost is that the
 * extension asks for access to all sites at install; see the README.
 */
(() => {
  'use strict';

  /** Hosts bundled with the extension. These cannot be removed. */
  const builtin = {
    'github.com': 'github',
    'gitlab.com': 'gitlab',
    'code.swecha.org': 'gitlab',
  };

  /**
   * A "kind" is which product a site is. The skin applied is always the other
   * one, so the kind decides the theme, the badge and the setting that drives
   * it — the setting is the kind's own key, so it is not repeated here.
   */
  const kinds = {
    github: {
      theme: 'gitlab',
      badge: 'GL',
      color: '#7759c2',
      other: 'GitLab',
    },
    gitlab: {
      theme: 'github',
      badge: 'GH',
      color: '#24292f',
      other: 'GitHub',
    },
  };

  const isKind = (value) => value === 'github' || value === 'gitlab';

  /**
   * The storage keys gitalike owns, kept beside the schema that gives them
   * meaning (the `settings` map is keyed by kind, the `instances` map by host).
   * Every context reads the same pair through `stateFrom`.
   */
  const SETTINGS_KEY = 'gitSameSettings';
  const INSTANCES_KEY = 'gitSameInstances';
  const STORAGE_KEYS = [SETTINGS_KEY, INSTANCES_KEY];

  /**
   * Every theme name, derived from `kinds` so a new kind contributes its theme
   * once instead of also having to be remembered in each context's `THEMES`.
   * @type {string[]}
   */
  const THEMES = Object.values(kinds).map((meta) => meta.theme);

  /**
   * The two stored maps with their defaults applied. Takes the raw result of
   * `storage.sync.get(STORAGE_KEYS)` so that the defaults live in one place.
   * @returns {{settings: object, instances: object}}
   */
  function stateFrom(stored) {
    return {
      settings: stored?.[SETTINGS_KEY] ?? {},
      instances: stored?.[INSTANCES_KEY] ?? {},
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

  // A bare hostname — no scheme, port, path, query, whitespace or wildcard — is
  // the only shape that is safe to hand to `scripting.registerContentScripts`
  // as a match pattern. The instances map is synced user data and could hold
  // anything, so a key that is not a bare host is ignored rather than turned
  // into a pattern (a `*` key would otherwise re-broaden injection to all sites).
  const HOSTNAME_RE = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
  function isHostname(value) {
    return (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length <= 253 &&
      HOSTNAME_RE.test(value)
    );
  }

  /** Every host of a kind: the bundled ones, then the user's, in that order. */
  function hostsFor(kind, added) {
    const hosts = Object.keys(builtin).filter((host) => builtin[host] === kind);
    const extra = added || {};
    for (const host of Object.keys(extra)) {
      if (extra[host] === kind && isHostname(host) && hosts.indexOf(host) === -1) {
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
    const raw = String(value === undefined || value === null ? '' : value).trim();
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
   * Is this kind's skin switched on? The predicate the popup rows, the badge
   * and `themeFor` all share, so "on" is defined exactly once. The setting is
   * stored under the kind's own name.
   */
  function kindOn(kind, settings) {
    const meta = kinds[kind];
    return Boolean(meta) && Boolean(settings) && settings[kind] === meta.theme;
  }

  /** The theme to apply for this host — 'gitlab', 'github', or null for none. */
  function themeFor(host, settings, added) {
    const kind = kindFor(host, added);
    return kind && kindOn(kind, settings) ? kinds[kind].theme : null;
  }

  globalThis.GITALIKE = {
    kinds,
    THEMES,
    SETTINGS_KEY,
    INSTANCES_KEY,
    STORAGE_KEYS,
    stateFrom,
    isKind,
    kindFor,
    hostsFor,
    isBuiltin,
    isHostname,
    parseHost,
    kindOn,
    themeFor,
  };
})();
