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
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { body, defaultSource, has, opt, reporter, sleep } from './store-api.mjs';

const { die, check } = reporter('publish-edge');

const API =
  process.env.EDGE_API_BASE || 'https://api.addons.microsoftedge.microsoft.com/v1';

const clientId = process.env.EDGE_CLIENT_ID || '';
const apiKey = process.env.EDGE_API_KEY || '';
const productId = opt('--product') || process.env.EDGE_PRODUCT_ID || '';
const dryRun = has('--dry-run');

const source = opt('--source') || (await defaultSource());

// v1.1 auth: the API key and client id both come from the Partner Center
// "Publish API" page. No token exchange.
const authHeaders = () => ({
  Authorization: `ApiKey ${apiKey}`,
  'X-ClientID': clientId,
});

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
