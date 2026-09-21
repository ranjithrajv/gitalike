#!/usr/bin/env node
/**
 * Publishes the Chromium build to Microsoft Edge Add-ons.
 *
 *   npm run publish:edge
 *   node tools/publish-edge.mjs --source dist/release/gitalike-chromium.zip
 *   node tools/publish-edge.mjs --dry-run
 *
 * Uses the Edge Add-ons **Update** REST API v1.1, which authenticates with two
 * headers from Partner Center — `Authorization: ApiKey <key>` and
 * `X-ClientID` — rather than the v1 Azure AD bearer token (v1 support ended
 * 2024-12-31). Only Node's standard library is used, matching build.mjs and
 * tools/publish-chromium.mjs.
 *
 * The API updates an extension that already exists. The **first** submission
 * has to be created in Partner Center by hand; after that, this script uploads
 * a new draft and publishes it. Edge accepts the same MV3 package as Chrome, so
 * the artefact is identical — the same bytes can go to both stores.
 *
 * Credentials come from the environment, never the command line:
 *
 *   EDGE_CLIENT_ID     Client ID from Partner Center → Publish API
 *   EDGE_API_KEY       API key from the same page
 *   EDGE_PRODUCT_ID    product id (a GUID) from the product's Partner Center URL
 *   EDGE_API_BASE      optional, override the API host
 *
 * Options:
 *   --source <zip>     package to upload (default: newest dist/artifacts/chromium/*.zip)
 *   --product <id>     override EDGE_PRODUCT_ID
 *   --no-publish       upload the draft only; do not submit it for review
 *   --dry-run          validate inputs and print the plan, then stop
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  const value = args[i + 1];
  return value === undefined || value.startsWith('--') ? '' : value;
};

const API =
  process.env.EDGE_API_BASE || 'https://api.addons.microsoftedge.microsoft.com/v1';

const clientId = process.env.EDGE_CLIENT_ID || '';
const apiKey = process.env.EDGE_API_KEY || '';
const productId = opt('--product') || process.env.EDGE_PRODUCT_ID || '';
const dryRun = has('--dry-run');

// Newest by mtime, not first alphabetically: an artifacts directory can hold a
// stale package from an earlier build, and uploading the wrong version would be
// worse than failing.
async function defaultSource() {
  const dir = join(root, 'dist', 'artifacts', 'chromium');
  if (!existsSync(dir)) return '';
  const zips = (await readdir(dir)).filter((name) => name.endsWith('.zip'));
  const dated = await Promise.all(
    zips.map(async (name) => ({ name, time: (await stat(join(dir, name))).mtimeMs })),
  );
  dated.sort((a, b) => b.time - a.time);
  return dated.length ? join(dir, dated[0].name) : '';
}

const source = opt('--source') || (await defaultSource());

function die(message) {
  console.error(`publish-edge: ${message}`);
  process.exit(1);
}

async function body(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function check(res, json, label) {
  if (res.ok) return json;
  console.error(`publish-edge: ${label} failed (HTTP ${res.status})`);
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}

// v1.1 auth: the API key and client id both come from the Partner Center
// "Publish API" page. No token exchange.
const authHeaders = () => ({
  Authorization: `ApiKey ${apiKey}`,
  'X-ClientID': clientId,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Both the upload and the publish are asynchronous: the POST answers 202 with a
// Location header pointing at an operation, which is polled until it settles.
async function pollOperation(location, label) {
  if (!location) die(`${label}: response had no Location header`);
  const url = new URL(location, API).toString();
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const res = await fetch(url, { headers: authHeaders() });
    const json = check(res, await body(res), `${label} status`);
    const status = String(json.status || '').toLowerCase();
    if (status === 'succeeded') return json;
    if (status === 'failed' || status === 'cancelled') {
      console.error(JSON.stringify(json, null, 2));
      die(`${label} did not succeed (status=${json.status})`);
    }
    console.log(`${label} ${json.status || 'pending'}…`);
    await sleep(5000);
  }
  die(`timed out waiting for ${label}`);
}

async function upload() {
  const zip = await readFile(source);
  console.log(`uploading ${source} (${zip.length} bytes)`);
  const res = await fetch(`${API}/products/${productId}/submissions/draft/package`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/zip' },
    body: zip,
  });
  const json = check(res, await body(res), 'upload');
  // A fast upload may already be done; otherwise the Location header carries the
  // operation to poll.
  const location = res.headers.get('location');
  if (location) await pollOperation(location, 'upload');
  return json;
}

async function publish() {
  const res = await fetch(`${API}/products/${productId}/submissions`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const json = check(res, await body(res), 'publish');
  const location = res.headers.get('location');
  if (location) await pollOperation(location, 'publish');
  console.log('submitted for review');
  return json;
}

/* -------------------------------------------------------------- validate -- */

if (has('--help')) {
  console.log('see the header of tools/publish-edge.mjs for usage');
  process.exit(0);
}
if (!source) die('no source package (pass --source, or build first)');
if (!existsSync(source)) die(`source not found: ${source}`);
if (!productId) die('missing EDGE_PRODUCT_ID (or --product)');

if (dryRun) {
  console.log(
    `dry run: ${source} -> products/${productId}` +
      (has('--no-publish') ? ' (upload draft only)' : ' (upload + publish)'),
  );
  process.exit(0);
}

if (!clientId) die('missing EDGE_CLIENT_ID');
if (!apiKey) die('missing EDGE_API_KEY');

/* ------------------------------------------------------------------ run -- */

await upload();
if (!has('--no-publish')) await publish();
console.log('done');
