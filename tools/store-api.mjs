#!/usr/bin/env node
/**
 * Shared plumbing for the store-publish tools (Chrome Web Store, Edge Add-ons).
 *
 * The two stores differ in auth and in the upload/publish calls, but the
 * scaffolding around them is the same: parse `--flag` arguments, find the newest
 * packaged zip, print-and-exit on a fatal error, decode a JSON response with a
 * raw-text fallback, and check an HTTP response. It lives here once, so a third
 * target does not become a third copy.
 *
 * Node's standard library only, matching build.mjs.
 */

import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The tool's own arguments, after `node tools/<tool>.mjs`. */
export const args = process.argv.slice(2);
export const has = (name) => args.includes(name);
export const opt = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const value = args[i + 1];
  return value === undefined || value.startsWith('--') ? '' : value;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The newest `.zip` in a directory by mtime, or '' when there is none. Newest by
 * mtime, not first alphabetically: an artifacts directory can hold a stale
 * package from an earlier build, and uploading the wrong version would be worse
 * than failing.
 */
export async function newestZip(dir) {
  if (!existsSync(dir)) return '';
  const zips = (await readdir(dir)).filter((name) => name.endsWith('.zip'));
  const dated = await Promise.all(
    zips.map(async (name) => ({
      name,
      time: (await stat(join(dir, name))).mtimeMs,
    })),
  );
  dated.sort((a, b) => b.time - a.time);
  return dated.length ? join(dir, dated[0].name) : '';
}

/** The newest packaged Chromium build — the artefact both stores accept. */
export const defaultSource = () =>
  newestZip(join(root, 'dist', 'artifacts', 'chromium'));

/** Decode a response body as JSON, or wrap the raw text when it is not JSON. */
export async function body(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * A `die`/`check` pair that prefixes messages with the calling tool's name, so
 * the shared helpers still say which tool failed.
 */
export function reporter(prefix) {
  const die = (message) => {
    console.error(`${prefix}: ${message}`);
    process.exit(1);
  };
  const check = (res, json, label) => {
    if (res.ok) return json;
    console.error(`${prefix}: ${label} failed (HTTP ${res.status})`);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  };
  return { die, check };
}
