/**
 * What gitalike knows about hosts, and the two skins it applies.
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
   * one, so the kind decides the theme, the badge and which setting drives it.
   */
  const kinds = {
    github: {
      setting: 'github',
      theme: 'gitlab',
      badge: 'GL',
      color: '#7759c2',
      other: 'GitLab',
    },
    gitlab: {
      setting: 'gitlab',
      theme: 'github',
      badge: 'GH',
      color: '#24292f',
      other: 'GitHub',
    },
  };

  const isKind = (value) => value === 'github' || value === 'gitlab';

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

  /** Every host of a kind: the bundled ones, then the user's, in that order. */
  function hostsFor(kind, added) {
    const hosts = Object.keys(builtin).filter((host) => builtin[host] === kind);
    const extra = added || {};
    for (const host of Object.keys(extra)) {
      if (extra[host] === kind && hosts.indexOf(host) === -1) hosts.push(host);
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

  /** Is the skin switched on for this host? null when the host is unknown. */
  function isOn(host, settings, added) {
    const kind = kindFor(host, added);
    if (!kind) return null;
    const meta = kinds[kind];
    return Boolean(settings) && settings[meta.setting] === meta.theme;
  }

  /** The theme to apply for this host — 'gitlab', 'github', or null for none. */
  function themeFor(host, settings, added) {
    if (!isOn(host, settings, added)) return null;
    return kinds[kindFor(host, added)].theme;
  }

  globalThis.GITALIKE = {
    builtin,
    kinds,
    isKind,
    kindFor,
    hostsFor,
    isBuiltin,
    parseHost,
    isOn,
    themeFor,
  };
})();
