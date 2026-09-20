#!/usr/bin/env node
/**
 * Builds dist/chromium and dist/firefox from src/.
 *
 * The two targets differ in exactly one place: how Manifest V3 declares its
 * background context. Chromium wants `background.service_worker`, Firefox wants
 * `background.scripts`. Everything else is shared, so both manifests are
 * generated from src/manifest.base.json.
 *
 * The version is read from package.json and stamped onto both manifests, so it
 * is bumped in exactly one place and the two can never drift.
 *
 *   node build.mjs            # both targets
 *   node build.mjs firefox    # one target
 */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const SRC = join(root, 'src');
const DIST = join(root, 'dist');
const BASE_MANIFEST = 'manifest.base.json';

const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

const TARGETS = {
  chromium: (manifest) => ({
    ...manifest,
    background: { service_worker: 'background.js' },
  }),
  firefox: (manifest) => ({
    ...manifest,
    // Firefox runs these in one shared scope, so lib/sites.js just has to come
    // first. Chromium reaches the same file via importScripts() (see background.js).
    background: { scripts: ['lib/sites.js', 'lib/ux.js', 'background.js'] },
    browser_specific_settings: {
      gecko: {
        // AMO binds the id permanently on first submission, so it must be a
        // string you are happy to keep. This uses the maintainer's mail domain;
        // swap in a domain you control before the first upload if you prefer.
        id: 'gitalike@riseup.net',
        // 142 is the first Firefox (desktop 140, Android 142) that understands
        // data_collection_permissions, so it is the floor that keeps the
        // manifest self-consistent. Nothing in the extension needs anything
        // newer.
        strict_min_version: '142.0',
        // Required by AMO for new extensions. gitalike sends nothing anywhere —
        // it has no network access at all — so it declares "none".
        data_collection_permissions: {
          required: ['none'],
        },
      },
    },
  }),
};

const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
const targets = requested.length ? requested : Object.keys(TARGETS);

let failed = false;

for (const target of targets) {
  const decorate = TARGETS[target];
  if (!decorate) {
    console.error(
      `unknown target "${target}" — use one of: ${Object.keys(TARGETS).join(', ')}`,
    );
    failed = true;
    continue;
  }

  const out = join(DIST, target);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  await cp(SRC, out, {
    recursive: true,
    filter: (source) => source !== join(SRC, BASE_MANIFEST),
  });

  const base = JSON.parse(await readFile(join(SRC, BASE_MANIFEST), 'utf8'));
  const manifest = decorate({ ...base, version });
  await writeFile(
    join(out, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  // GPLv3 wants the licence and notices to travel with every conveyed copy, so
  // they go into the packaged extension too, not only the repository.
  await cp(join(root, 'LICENSE'), join(out, 'LICENSE'));
  await cp(join(root, 'NOTICE'), join(out, 'NOTICE'));

  console.log(`built dist/${target}`);
}

if (failed) process.exitCode = 1;
