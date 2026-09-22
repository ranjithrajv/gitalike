#!/usr/bin/env node
/**
 * Per-source recipes for `style-parity.mjs` — where each source's project and
 * profile pages keep their chrome, and the reviewed vocabulary each target
 * product's menu carries. Both are derived from the plugin folders: a source's
 * `parity.mjs` carries its selectors, a skin's carries its target vocabulary.
 *
 * It is pure data with no Playwright import, so a test can check that every
 * registry source has a recipe (and every skin a target vocabulary) without
 * launching a browser. `style-parity.mjs` is the only consumer.
 *
 * A recipe's `url` is the page the tool drives, `ready` is the selector it waits
 * for, and `header` / `nav` / `link` are selector lists resolved in order — a
 * rebuilt element wins over a leftover one. Gerrit's chrome is inside `gr-app`'s
 * open shadow root; `readChrome` in the tool descends into shadow roots to find
 * it, so its selectors are the shadow elements by name.
 */

import '../plugins.mjs';
import { loadSkinParity, loadSourceParity } from './parity-files.mjs';

export const PROJECT_SELECTORS = {};
export const PROFILE_SELECTORS = {};
for (const name of Object.keys(globalThis.GITALIKE_PLUGINS.sources)) {
  const { selectors } = await loadSourceParity(name);
  PROJECT_SELECTORS[name] = selectors.project;
  PROFILE_SELECTORS[name] = selectors.profile;
}

// The words each target product's menu carries, per page type. The navigation
// *shape* is not here — it comes from the skin's own `layout`.
export const PROJECT_VOCAB = {};
export const PROFILE_VOCAB = {};
for (const name of Object.keys(globalThis.GITALIKE_PLUGINS.skins)) {
  const { vocab } = await loadSkinParity(name);
  PROJECT_VOCAB[name] = vocab.project;
  PROFILE_VOCAB[name] = vocab.profile;
}
