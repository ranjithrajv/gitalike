/**
 * gitalike — background context.
 *
 * A service worker on Chromium, an event page on Firefox. Its only jobs are the
 * keyboard command and the per-tab toolbar badge; the reskin itself is done by
 * the content script and its stylesheets.
 */
'use strict';

// Chromium runs this as a classic service worker, where importScripts() is how
// you pull in a sibling file. Firefox runs both scripts listed in the manifest
// in one shared scope, so there it is already defined and importScripts does
// not exist.
if (typeof importScripts === 'function') importScripts('lib/sites.js');

const api = globalThis.browser ?? globalThis.chrome;
const SITES = globalThis.GITALIKE;

const SETTINGS_KEY = 'gitSameSettings';
const INSTANCES_KEY = 'gitSameInstances';

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function readMaps() {
  const stored = await api.storage.sync.get([SETTINGS_KEY, INSTANCES_KEY]);
  return {
    settings: stored?.[SETTINGS_KEY] ?? {},
    instances: stored?.[INSTANCES_KEY] ?? {},
  };
}

async function refreshBadge(tabId, url) {
  if (tabId == null) return;

  const host = hostOf(url);
  const { settings, instances } = await readMaps();
  const on = host ? SITES.isOn(host, settings, instances) === true : false;
  const meta = on ? SITES.kinds[SITES.kindFor(host, instances)] : null;

  await api.action.setBadgeText({ tabId, text: on ? meta.badge : '' });
  if (on) {
    await api.action.setBadgeBackgroundColor({ tabId, color: meta.color });
  }
  await api.action.setTitle({
    tabId,
    title: on ? `gitalike — showing the ${meta.other} UI` : 'gitalike',
  });
}

async function refreshAllBadges() {
  // Every tab, since a configured instance can be any host.
  const tabs = await api.tabs.query({});
  await Promise.all(tabs.map((tab) => refreshBadge(tab.id, tab.url)));
}

/* --------------------------------------------------------------- command -- */

api.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-site') return;

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  const host = hostOf(tab?.url);
  if (!host || tab.id == null) return;

  const { settings, instances } = await readMaps();
  const kind = SITES.kindFor(host, instances);
  // An unrecognised host needs a choice of UI, which only the popup can offer.
  if (!kind) return;

  const meta = SITES.kinds[kind];
  settings[meta.setting] = SITES.isOn(host, settings, instances)
    ? 'off'
    : meta.theme;

  // storage.onChanged fans this out to the content scripts and the badges.
  await api.storage.sync.set({ [SETTINGS_KEY]: settings });
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

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (changes[SETTINGS_KEY] || changes[INSTANCES_KEY]) refreshAllBadges();
});

api.runtime.onInstalled.addListener(refreshAllBadges);
api.runtime.onStartup.addListener(refreshAllBadges);
