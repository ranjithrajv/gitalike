#!/usr/bin/env node
/**
 * Publishes the Chromium build to the Chrome Web Store.
 *
 *   npm run publish:chromium
 *   node tools/publish-chromium.mjs --source dist/artifacts/chromium/*.zip
 *   node tools/publish-chromium.mjs --dry-run
 *
 * Uses the Chrome Web Store **v2** API only. (v1 is deprecated and stops being
 * supported on 15 October 2026.) Only Node's standard library is used, matching
 * build.mjs — no runtime or dev dependency is added.
 *
 * Credentials come from the environment, never the command line, so they do not
 * end up in shell history or a process listing:
 *
 *   CWS_CLIENT_ID        OAuth2 client id
 *   CWS_CLIENT_SECRET    OAuth2 client secret
 *   CWS_REFRESH_TOKEN    OAuth2 refresh token, scope .../auth/chromewebstore
 *   CWS_PUBLISHER_ID     Chrome Web Store publisher id
 *   CWS_ITEM_ID          extension id (CWS_EXTENSION_ID also accepted)
 *
 * Options:
 *   --source <zip>        package to upload (default: first dist/artifacts/chromium/*.zip)
 *   --publisher <id>      override CWS_PUBLISHER_ID
 *   --item <id>           override CWS_ITEM_ID
 *   --staged              publish as a staged release instead of immediately
 *   --deploy-percentage N publish to N% of users (0–100)
 *   --skip-review         ask the store to skip review (it validates eligibility)
 *   --no-publish          upload only; do not submit for review
 *   --dry-run             validate inputs and print the plan, then stop
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { body, defaultSource, has, opt, reporter } from './store-api.mjs';

const { die, check } = reporter('publish-chromium');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://chromewebstore.googleapis.com/v2';
const UPLOAD_API = 'https://chromewebstore.googleapis.com/upload/v2';

const clientId = process.env.CWS_CLIENT_ID || '';
const clientSecret = process.env.CWS_CLIENT_SECRET || '';
const refreshToken = process.env.CWS_REFRESH_TOKEN || '';
const publisherId = opt('--publisher') || process.env.CWS_PUBLISHER_ID || '';
const itemId =
  opt('--item') ||
  process.env.CWS_ITEM_ID ||
  process.env.CWS_EXTENSION_ID ||
  '';
const dryRun = has('--dry-run');

const source = opt('--source') || (await defaultSource());

async function accessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const json = check(res, await body(res), 'token exchange');
  if (!json.access_token) die('token exchange returned no access_token');
  return json.access_token;
}

async function fetchStatus(token) {
  const res = await fetch(
    `${API}/publishers/${publisherId}/items/${itemId}:fetchStatus`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return check(res, await body(res), 'fetchStatus');
}

async function upload(token) {
  const zip = await readFile(source);
  console.log(`uploading ${source} (${zip.length} bytes)`);
  const res = await fetch(
    `${UPLOAD_API}/publishers/${publisherId}/items/${itemId}:upload`,
    {
      method: 'POST',
      // Google's own example uploads the file with no explicit type; the store
      // accepts the zip bytes either way. If this is ever rejected, try
      // application/octet-stream.
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
      },
      body: zip,
    },
  );
  const json = check(res, await body(res), 'upload');

  if (json.uploadState === 'SUCCEEDED') return json;
  if (json.uploadState !== 'IN_PROGRESS')
    die(`upload state ${json.uploadState}`);

  // Large packages upload asynchronously; poll until it settles.
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const status = await fetchStatus(token);
    const state = status.lastAsyncUploadState;
    if (state === 'SUCCEEDED') return status;
    if (state === 'FAILED' || state === 'NOT_FOUND') {
      die(`upload did not succeed (lastAsyncUploadState=${state})`);
    }
    console.log(`upload ${state || 'pending'}…`);
  }
  die('timed out waiting for the upload to finish');
}

async function publish(token) {
  const deploy = opt('--deploy-percentage');
  const payload = {
    publishType: has('--staged') ? 'STAGED_PUBLISH' : 'DEFAULT_PUBLISH',
    skipReview: has('--skip-review') || undefined,
    blockOnWarnings: false,
  };
  if (deploy !== null && deploy !== '') {
    payload.deployInfos = [{ deployPercentage: Number(deploy) }];
  }
  const res = await fetch(
    `${API}/publishers/${publisherId}/items/${itemId}:publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
  const json = check(res, await body(res), 'publish');
  const warnings = json.warningInfo?.warnings?.length
    ? ` (${json.warningInfo.warnings.length} warning(s))`
    : '';
  console.log(`published: state=${json.state}${warnings}`);
}

/* -------------------------------------------------------------- validate -- */

if (has('--help')) {
  console.log('see the header of tools/publish-chromium.mjs for usage');
  process.exit(0);
}
if (!source) die('no source package (pass --source, or build first)');
if (!existsSync(source)) die(`source not found: ${source}`);
if (!publisherId) die('missing CWS_PUBLISHER_ID (or --publisher)');
if (!itemId) die('missing CWS_ITEM_ID (or --item)');

if (dryRun) {
  console.log(
    `dry run: ${source} -> publishers/${publisherId}/items/${itemId}` +
      (has('--no-publish') ? ' (upload only)' : ' (upload + publish)'),
  );
  process.exit(0);
}

if (!clientId) die('missing CWS_CLIENT_ID');
if (!clientSecret) die('missing CWS_CLIENT_SECRET');
if (!refreshToken) die('missing CWS_REFRESH_TOKEN');

/* ------------------------------------------------------------------ run -- */

const token = await accessToken();
await upload(token);
if (!has('--no-publish')) await publish(token);
console.log('done');
