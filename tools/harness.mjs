#!/usr/bin/env node
/**
 * Shared Playwright harness for the tools that drive the built extension.
 *
 * Every tool that loads `dist/chromium` unpacked needs the same things: resolve
 * a browser, refuse to run without a build, launch a persistent context with the
 * extension loaded, find the extension id, and open a popup page whose storage
 * helpers read the extension's own schema keys. They live here once, so a change
 * to Chromium's extension flags — or to the storage schema — is one edit rather
 * than four.
 *
 *   import { launch, retry } from './harness.mjs';
 *   const { context, popup, setSettings, close } = await launch({ viewport });
 *
 * Only `playwright-core` is needed — the browser is the system Chromium, so
 * nothing is downloaded. Point at a different browser with `GS_CHROME=...`, and
 * at a different build with `GS_EXT=...`.
 */

import { chromium } from 'playwright-core';
import { mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The unpacked Chromium build the tools drive. */
export const EXT = process.env.GS_EXT ?? join(root, 'dist', 'chromium');

const CHROME_CANDIDATES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
];

function resolveChrome() {
  const chrome = process.env.GS_CHROME ?? CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error('no Chromium found — set GS_CHROME=/path/to/chrome');
  return chrome;
}

function requireBuild() {
  if (!existsSync(join(EXT, 'manifest.json'))) {
    throw new Error(`no manifest.json in ${EXT} — run "npm run build:chromium" first`);
  }
}

/**
 * Launch the built extension in a fresh persistent context.
 *
 * @returns {Promise<{
 *   context: import('playwright-core').BrowserContext,
 *   extensionId: string,
 *   popup: import('playwright-core').Page,
 *   setSettings: (settings: object) => Promise<void>,
 *   setHostSettings: (hostSettings: object) => Promise<void>,
 *   close: () => Promise<void>,
 * }>}
 */
export async function launch({ viewport, headless = true, profilePrefix = 'gs-' } = {}) {
  const chrome = resolveChrome();
  requireBuild();

  const profile = await mkdtemp(join(tmpdir(), profilePrefix));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: chrome,
    headless,
    viewport,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 25000 });
  const extensionId = new URL(worker.url()).host;

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);

  // The key names come from the shared table the popup page has already loaded,
  // so a tool cannot drift if the storage schema is renamed.
  const setSettings = (settings) =>
    popup.evaluate(
      (s) => chrome.storage.sync.set({ [globalThis.GITALIKE.SETTINGS_KEY]: s }),
      settings,
    );
  const setHostSettings = (hostSettings) =>
    popup.evaluate(
      (s) => chrome.storage.sync.set({ [globalThis.GITALIKE.HOST_SETTINGS_KEY]: s }),
      hostSettings,
    );

  return {
    context,
    extensionId,
    popup,
    setSettings,
    setHostSettings,
    close: () => context.close(),
  };
}

/** Live sites hiccup; retry a navigation a few times before giving up. */
export async function retry(action, attempts = 4, delay = 1500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await action();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
