/**
 * gitalike — background context.
 *
 * A service worker on Chromium, an event page on Firefox. It handles the
 * keyboard command, the per-tab toolbar badge, and registering the content
 * scripts and stylesheets for the configured hosts; the reskin itself is done
 * by the content script and its stylesheets.
 */
'use strict';

// Chromium runs this as a classic service worker, where importScripts() is how
// you pull in a sibling file. Firefox runs both scripts listed in the manifest
// in one shared scope, so there it is already defined and importScripts does
// not exist.
if (typeof importScripts === 'function') importScripts('lib/sites.js', 'lib/ux.js');

const api = globalThis.browser ?? globalThis.chrome;
const SITES = globalThis.GITALIKE;
const UX = globalThis.GITALIKE_UX;

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function readState() {
  return SITES.stateFrom(await api.storage.sync.get(SITES.STORAGE_KEYS));
}

// What each tab is already showing, so a refresh that changes nothing does not
// call the action API again. The service worker may be torn down between
// events; an empty cache just means one redundant write.
const shownBadge = new Map();

async function refreshBadge(tabId, url, state) {
  if (tabId == null) return;

  const { settings, instances, hostSettings } = state ?? (await readState());
  const host = hostOf(url);
  const kind = host ? SITES.kindFor(host, instances) : null;
  // The badge follows the *effective* skin, per-host choice included, so a host
  // wearing a different skin (or spared) does not claim the wrong one.
  const theme = host
    ? SITES.themeFor(host, settings, instances, hostSettings)
    : null;
  const on = Boolean(theme && kind);
  const skin = on ? SITES.skins[theme] : null;
  const text = on ? skin.badge : '';
  const title = on ? `gitalike — showing the ${skin.product} UI` : 'gitalike';

  const previous = shownBadge.get(tabId);
  if (previous && previous.text === text && previous.title === title) return;
  shownBadge.set(tabId, { text, title });

  await api.action.setBadgeText({ tabId, text });
  if (on) await api.action.setBadgeBackgroundColor({ tabId, color: skin.color });
  await api.action.setTitle({ tabId, title });
}

async function refreshAllBadges() {
  // One storage read for every tab, rather than one per tab.
  const state = await readState();
  const tabs = await api.tabs.query({});
  await Promise.all(tabs.map((tab) => refreshBadge(tab.id, tab.url, state)));
}

/* --------------------------------------------------- content scripts -- */

// The content scripts and stylesheets are registered for exactly the hosts the
// extension has been set up on, instead of being injected into all of them by
// the manifest. An unconfigured page then never parses the vocabulary or the
// two stylesheets. Registering needs no new host permission: the extension
// already declares access to all sites.
const SCRIPT_ID = 'gitalike-ux';
const CSS_ID = 'gitalike-theme';
const CONTENT_JS = [
  'lib/sites.js',
  'lib/ux.js',
  'content/theme.js',
  'content/ux.js',
];
const CONTENT_CSS = [
  'themes/as-gitlab.css',
  'themes/as-github.css',
  'themes/ux-markers.css',
  'themes/ux-nav.css',
];

const hostPattern = (host) => `*://${host}/*`;
const patternHost = (pattern) => pattern.replace(/^\*:\/\//, '').replace(/\/\*$/, '');

// Every host the extension knows, bundled and user-added, de-duplicated. Only
// hosts that classify as a kind are returned, so junk in the instances map can
// never register an injection where the extension does nothing.
function knownHosts(instances) {
  const hosts = [];
  for (const kind of Object.keys(SITES.kinds)) {
    for (const host of SITES.hostsFor(kind, instances)) {
      // hostsFor already drops non-hostnames; the guard here is belt-and-braces
      // so a future caller cannot feed a wildcard or path into a match pattern.
      if (SITES.isHostname(host) && !hosts.includes(host)) hosts.push(host);
    }
  }
  return hosts;
}

// Is the registration already exactly what we would write? Then leave it alone,
// which keeps a service-worker wake on an ordinary tab switch from churning the
// registry. A browser that reports the definitions differently just fails the
// comparison and re-registers, which is harmless.
function sameDefinition(previous, patterns) {
  if (!patterns.length) return previous.length === 0;
  if (previous.length !== 2) return false;
  const want = patterns.join('\n');
  const js = previous.find((entry) => entry.id === SCRIPT_ID);
  const css = previous.find((entry) => entry.id === CSS_ID);
  return Boolean(
    js &&
      css &&
      (js.matches || []).join('\n') === want &&
      (css.matches || []).join('\n') === want &&
      (js.js || []).join('\n') === CONTENT_JS.join('\n') &&
      (css.css || []).join('\n') === CONTENT_CSS.join('\n'),
  );
}

async function injectIntoOpenTabs(hosts) {
  const tabs = await api.tabs.query({});
  for (const tab of tabs) {
    if (tab.id == null || !hosts.has(hostOf(tab.url))) continue;
    try {
      // A host added while its page is already open: inject now so the skin
      // appears without a reload, the way the static injection used to. Re-read
      // the tab first — it may have navigated since the query, and injection
      // targets whatever is loaded now, not the URL that matched.
      const current = await api.tabs.get(tab.id).catch(() => null);
      if (!current || !hosts.has(hostOf(current.url))) continue;
      await api.scripting.insertCSS({ target: { tabId: tab.id }, files: CONTENT_CSS });
      await api.scripting.executeScript({
        target: { tabId: tab.id },
        files: CONTENT_JS,
      });
    } catch {
      /* a restricted page (chrome://, the store) — nothing to inject into */
    }
  }
}

async function registerContentScripts(injectNew) {
  if (!api.scripting?.registerContentScripts) return;

  const { instances } = await readState();
  const patterns = knownHosts(instances).map(hostPattern);

  // What was registered before unregistering, so a newly added host can be
  // injected into the tab that is already open on it.
  let previous = [];
  try {
    previous = await api.scripting.getRegisteredContentScripts({
      ids: [SCRIPT_ID, CSS_ID],
    });
  } catch {
    previous = [];
  }
  const before = new Set(previous.flatMap((entry) => entry.matches || []));

  if (sameDefinition(previous, patterns)) return;

  try {
    await api.scripting.unregisterContentScripts({ ids: [SCRIPT_ID, CSS_ID] });
  } catch {
    /* nothing registered yet */
  }

  if (patterns.length) {
    await api.scripting.registerContentScripts([
      { id: SCRIPT_ID, matches: patterns, js: CONTENT_JS, runAt: 'document_start' },
      { id: CSS_ID, matches: patterns, css: CONTENT_CSS, runAt: 'document_start' },
    ]);
  }

  if (injectNew) {
    const added = new Set(
      patterns.filter((pattern) => !before.has(pattern)).map(patternHost),
    );
    if (added.size) await injectIntoOpenTabs(added);
  }
}

// Install, startup and a settings change can all ask for this at once; run them
// in order so a register and an unregister never overlap.
let registration = Promise.resolve();

function syncContentScripts({ injectNew = false } = {}) {
  registration = registration
    .then(() => registerContentScripts(injectNew))
    .catch((error) => {
      // If registration fails the extension is silently inert; leave a trace in
      // the background console rather than swallowing it.
      console.warn('gitalike: content-script registration failed', error);
    });
  return registration;
}

/* --------------------------------------------------------------- command -- */

api.commands.onCommand.addListener(async (command) => {
  // Open the current page on the other forge, when the pair is known.
  if (command === 'open-other-host') {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    const url = UX?.otherHostUrl(tab?.url);
    if (url) await api.tabs.create({ url });
    return;
  }

  if (command !== 'toggle-site') return;

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const host = hostOf(tab?.url);
  if (!host || tab.id == null) return;

  const { settings, instances, hostSettings } = await readState();
  const kind = SITES.kindFor(host, instances);
  // An unrecognised host needs a choice of UI, which only the popup can offer.
  if (!kind) return;

  // Toggle *this host*, not the whole product: the command is described as
  // "for the current site", and a per-host choice is what makes an enterprise
  // instance independent of github.com. Off switches the skin off for this host;
  // on gives it the product's default skin (the popup can pick another one).
  const on = SITES.themeFor(host, settings, instances, hostSettings) !== null;
  await api.storage.sync.set({
    [SITES.HOST_SETTINGS_KEY]: {
      ...hostSettings,
      [host]: on ? 'off' : SITES.kinds[kind].theme,
    },
  });
});

/* ---------------------------------------------------------------- badges -- */

api.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await api.tabs.get(tabId).catch(() => null);
  await refreshBadge(tabId, tab?.url);
});

api.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    await refreshBadge(tabId, tab.url);
  }
});

api.tabs.onRemoved.addListener((tabId) => shownBadge.delete(tabId));

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes[SITES.INSTANCES_KEY]) {
    // A host was added or removed: re-scope the registration, and inject into
    // any already-open tab on a host that was just added.
    syncContentScripts({ injectNew: true });
  }
  if (
    changes[SITES.SETTINGS_KEY] ||
    changes[SITES.INSTANCES_KEY] ||
    changes[SITES.HOST_SETTINGS_KEY]
  ) {
    refreshAllBadges();
  }
});

api.runtime.onInstalled.addListener(() => {
  syncContentScripts({ injectNew: true });
  refreshAllBadges();
});
api.runtime.onStartup.addListener(() => {
  syncContentScripts();
  refreshAllBadges();
});

// The worker can start for any event; make sure the configured hosts are
// registered even when neither install nor startup fired this session.
syncContentScripts();
