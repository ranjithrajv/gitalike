#!/usr/bin/env node
/**
 * Pre-commit gate for gitalike.
 *
 * The point is to catch, before the commit exists, every failure that CI would
 * otherwise catch after a push — plus the cheap mistakes CI does not look for
 * (merge conflict markers, a desynced package-lock, a token pasted into a
 * file). The repository keeps its zero-dependency stance: this is Node's
 * standard library only, and the heavy checks shell out to the same `npm test`
 * and `npm run lint` that CI runs.
 *
 * Every static check reads the *staged* blob (`git show :path`), never the
 * working tree, so a partially staged file is judged on what the commit will
 * actually contain rather than on edits still sitting in the editor.
 *
 * Install (the `prepare` script does it on `npm install`):
 *
 *   npm run hooks:install
 *
 * Bypass for a genuine emergency — CI is still the real gate:
 *
 *   git commit --no-verify
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

// A staged blob larger than this is almost never intentional; it is usually a
// dataset, a video, or a browser profile committed by accident. Screenshots in
// the repository top out well under 300 KB.
const MAX_BLOB_BYTES = 2 * 1024 * 1024;

const JS_EXT = new Set(['.js', '.mjs', '.cjs']);

// High-signal token shapes only. A generic "key = ..." heuristic would fire on
// the placeholder names in docs and the store listings, and a gate that cries
// wolf is a gate people learn to bypass. The value itself is never printed —
// only the file and line — so a real secret does not end up in a log.
const SECRETS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key block'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'an AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'a GitHub token'],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/, 'a GitLab personal access token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'a Slack token'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'a Google API key'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'an API key'],
];

const indent = (text) =>
  text
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n');

const tryRead = (path) => {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
};

// cwd is the repository root for every child, regardless of where git invoked
// the hook from, so the npm scripts and the relative paths agree.
const run = (command, args, opts = {}) =>
  spawnSync(command, args, { cwd: root, encoding: 'utf8', ...opts });

const git = (...args) => run('git', args);

// The index, not the worktree. `-z` keeps paths containing spaces or newlines
// intact; the filter drops deletions, which have no blob to inspect.
const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')
  .stdout.split('\0')
  .filter(Boolean);

const blobs = new Map();
for (const path of staged) {
  const res = run('git', ['show', `:${path}`], { maxBuffer: 64 * 1024 * 1024 });
  blobs.set(path, res.status === 0 ? res.stdout : null);
}

const isText = (buf) => buf && buf.length > 0 && !buf.includes(0);

/** @type {{name: string, failures: string[], warnings: string[]}[]} */
const checks = [];
const add = (name, failures, warnings = []) => {
  if (failures.length || warnings.length) checks.push({ name, failures, warnings });
};

// --- Staged content ---------------------------------------------------------

{
  const failures = [];
  const warnings = [];
  const conflict = /^(<{7}|={7}|>{7})(?: |$)/m;
  const scripts = [];
  const json = [];
  let tmp = null;

  for (const [path, buf] of blobs) {
    if (buf && buf.length > MAX_BLOB_BYTES) {
      failures.push(
        `${path} is ${(buf.length / 1024 / 1024).toFixed(1)} MiB — too large ` +
          'to be intentional (bypass with `git commit --no-verify`)',
      );
      continue;
    }
    if (!isText(buf)) continue;

    const text = buf.toString('utf8');

    if (conflict.test(text)) failures.push(`${path} contains merge conflict markers`);
    if (text.includes('\r')) {
      failures.push(`${path} uses CRLF line endings — this repository is LF-only`);
    }
    if (!text.endsWith('\n')) {
      failures.push(`${path} has no final newline`);
    } else if (text.endsWith('\n\n')) {
      warnings.push(`${path} ends with a blank line`);
    }

    const ext = extname(path);
    if (ext === '.json') json.push([path, text]);
    if (JS_EXT.has(ext)) scripts.push([path, buf]);

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const hit = SECRETS.find(([pattern]) => pattern.test(lines[i]));
      if (hit) failures.push(`${path}:${i + 1} looks like ${hit[1]}`);
    }
  }

  for (const [path, text] of json) {
    try {
      JSON.parse(text);
    } catch (error) {
      failures.push(`${path} is not valid JSON — ${String(error.message).split('\n')[0]}`);
    }
  }

  // `node --check` is the real parser, so it catches what a regex cannot and
  // stays in step with the runtime that will execute the file. Temp files keep
  // the check on the staged bytes; the directory has no package.json, so a
  // classic script in src/ is parsed as the CommonJS the browser does not care
  // about either way.
  if (scripts.length) {
    tmp = await mkdtemp(join(tmpdir(), 'gitalike-pre-commit-'));
    let n = 0;
    for (const [path, buf] of scripts) {
      const file = join(tmp, `f${n++}${extname(path)}`);
      await writeFile(file, buf);
      const res = run('node', ['--check', file], { cwd: tmp });
      if (res.status !== 0) {
        const detail = res.stderr.replaceAll(file, path).trim();
        failures.push(`${basename(path)} fails to parse:\n${indent(detail)}`);
      }
    }
  }

  add('staged files', failures, warnings);
  if (tmp) await rm(tmp, { recursive: true, force: true });
}

// --- Package lockfile -------------------------------------------------------
//
// The version lives in package.json and is stamped onto both generated
// manifests, but package-lock.json carries its own copy. Letting the two drift
// makes `npm ci` and the store builds disagree about what they are shipping.
// Dependencies are the other half: `npm ci` installs strictly from the lock, so
// a dependency added to package.json but not to the lock ships a build without
// it. Description-only edits are exempt — there the lock has nothing to say.
{
  const failures = [];
  const parse = (buf) => {
    try {
      return JSON.parse(buf.toString('utf8'));
    } catch {
      return null; // Malformed JSON is reported by the staged-files check.
    }
  };
  const lock = blobs.has('package-lock.json')
    ? blobs.get('package-lock.json')
    : tryRead(join(root, 'package-lock.json'));
  const pkg = blobs.has('package.json')
    ? blobs.get('package.json')
    : tryRead(join(root, 'package.json'));
  const head = run('git', ['show', 'HEAD:package.json'], { maxBuffer: 64 * 1024 * 1024 });
  const p = pkg && parse(pkg);
  const l = lock && parse(lock);
  const previous = head.status === 0 ? parse(head.stdout) : null;

  if (p && l) {
    const locked = l.packages?.['']?.version ?? l.version;
    if (l.version !== p.version || locked !== p.version) {
      failures.push(
        `package-lock.json is at ${l.version}/${locked} but package.json is at ` +
          `${p.version} — run \`npm install\` to resync`,
      );
    }

    const DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
    for (const field of DEP_FIELDS) {
      const now = JSON.stringify(p[field] ?? {});
      const inLock = JSON.stringify(l.packages?.['']?.[field] ?? {});
      if (now !== inLock) {
        failures.push(`${field} differ from package-lock.json — run \`npm install\` to resync`);
      } else if (
        previous &&
        staged.includes('package.json') &&
        !staged.includes('package-lock.json') &&
        JSON.stringify(previous[field] ?? {}) !== now
      ) {
        failures.push(`${field} changed but package-lock.json is not staged`);
      }
    }
  }

  add('package lockfile', failures);
}

// --- Changelog reminder -----------------------------------------------------
//
// CONTRIBUTING asks for a CHANGELOG entry on user-visible changes. Which
// changes count is a judgement call, so this is a warning, never a gate.
{
  const warnings = [];
  const touchesSrc = staged.some((path) => path.startsWith('src/'));
  if (touchesSrc && !staged.includes('CHANGELOG.md')) {
    warnings.push(
      'src/ changed without a CHANGELOG.md entry — add one under "## [Unreleased]" ' +
        'if this is user-visible',
    );
  }
  add('changelog', [], warnings);
}

// --- The same gate CI runs --------------------------------------------------

for (const [label, args] of [
  ['npm test', ['test']],
  ['npm run lint', ['run', 'lint']],
]) {
  const res = run(NPM, args);
  if (res.status === 0) continue;
  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  add(label, [`\`${label}\` failed:\n${indent(output)}`]);
}

// --- Report -----------------------------------------------------------------

const failures = checks.reduce((sum, check) => sum + check.failures.length, 0);
const warnings = checks.reduce((sum, check) => sum + check.warnings.length, 0);

if (failures) {
  console.error(`\npre-commit: ${failures} problem(s) in ${staged.length} staged file(s)\n`);
  for (const check of checks) {
    if (!check.failures.length) continue;
    console.error(`  ✗ ${check.name}`);
    for (const message of check.failures) console.error(`    - ${message}`);
  }
  for (const check of checks) {
    for (const message of check.warnings) console.error(`  ! ${message}`);
  }
  console.error('\n  Fix the above, or bypass with `git commit --no-verify`.\n');
  process.exit(1);
}

if (warnings) {
  for (const check of checks) {
    for (const message of check.warnings) console.warn(`pre-commit: ${message}`);
  }
}
