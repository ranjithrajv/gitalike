#!/usr/bin/env node
/**
 * Live preview: the built extension, the real sites, and the skins — in a real
 * browser window, or captured to a scratch directory.
 *
 *   node tools/compare/preview.mjs                     headed, opens and holds
 *   node tools/compare/preview.mjs --shots             capture to /tmp, no window
 *   node tools/compare/preview.mjs --only github       just the GitHub skin
 *   node tools/compare/preview.mjs --headless --shots  capture without a window
 *
 * `screenshots.mjs` writes the committed captures in `docs/`, which
 * `color-parity.mjs` reads as its evidence — so this writes to a scratch
 * directory and never touches them. The pairs it renders are the two reference
 * directions, the ones the skins were built for, each against the real product
 * it imitates:
 *
 *   github.com          bare, then with the GitLab skin
 *   gitlab.com          bare, then with the GitHub skin
 *
 * That pairing is the point: a preview of the skin alone shows what it looks
 * like, and only the pair shows whether it looks like the thing. With
 * `--hold` (the default) the window stays open and navigates between them, so
 * the change can be watched rather than inferred from two files.
 *
 * Live sites, so it is an on-demand tool, not a commit gate. Needs a build
 * (`npm run build:chromium`) and a Chromium; the same ones `screenshots.mjs`
 * uses, overridable with `GS_CHROME` and `GS_EXT`.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { launch, retry, waitForNoTheme, waitForTheme } from './harness.mjs';
import { SOURCES as CAPTURE_SOURCES } from './captures.mjs';
import '../plugins.mjs';

const args = new Set(process.argv.slice(2));
const want = (flag) => args.has(`--${flag}`);
const value = (flag, fallback) => {
  const hit = [...args].find((a) => a.startsWith(`--${flag}=`));
  return hit ? hit.slice(flag.length + 3) : fallback;
};

const ONLY = value('only', null);
const SHOTS = want('shots');
const HEADLESS = want('headless');
const HOLD = !SHOTS || want('hold');
const OUT = process.env.GS_OUT ?? join(tmpdir(), 'gitalike-preview');
/** Milliseconds to let the app and the structural passes finish. */
const SETTLE = Number(value('settle', 8000));

/** A source that is not a bundled host is granted for this run only. */
const instances = Object.fromEntries(
  CAPTURE_SOURCES.filter((s) => s.instance).map((s) => [
    s.instance.host,
    s.instance.kind,
  ]),
);
const grantedHosts = CAPTURE_SOURCES.filter((s) => s.instance).map(
  (s) => s.instance.host,
);

// The two reference directions, so a preview is a like-for-like pair rather than
// a skin shown against nothing.
//
// Each pair carries two selectors. `ready` is the chrome the skin hooks, waited
// for before the frame is trusted. `settled` is page *content*, which is what
// actually says the app has finished rendering. Waiting on chrome alone captures
// GitLab mid-repaint — the skin's CSS over a half-drawn body — which looks like
// a catastrophic skin bug and is not one.
const PAIRS = [
  {
    name: 'github',
    host: 'github.com',
    url: 'https://github.com/microsoft/vscode',
    ready: '.UnderlineNav-item, .prc-components-UnderlineItem',
    settled: 'table[aria-label="Files"], .react-directory-filename-column',
    skins: { gitlab: 'github-as-gitlab' },
  },
  {
    name: 'gitlab',
    host: 'gitlab.com',
    url: 'https://gitlab.com/gitlab-org/gitlab',
    ready:
      '.super-sidebar:not(.super-sidebar-loading), [data-testid="project-header"]',
    settled: '.tree-holder, [data-testid="tree-holder"], .file-holder',
    skins: { github: 'gitlab-as-github' },
  },
];

const OFF = Object.fromEntries(
  Object.keys(globalThis.GITALIKE.kinds).map((kind) => [kind, 'off']),
);

const jobs = PAIRS.flatMap((pair) => [
  { ...pair, skin: null, label: `${pair.name}-bare` },
  ...Object.entries(pair.skins).map(([skin, label]) => ({
    ...pair,
    skin,
    label,
  })),
]).filter((job) => !ONLY || job.label.includes(ONLY) || job.skin === ONLY);

if (!jobs.length) {
  console.error(`no job matches --only ${ONLY}`);
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

const { context, setSettings, setHostSettings, setInstances, close } =
  await launch({
    viewport: { width: 1280, height: 900 },
    headless: HEADLESS,
    profilePrefix: 'gs-preview-',
    hosts: grantedHosts,
  });

if (Object.keys(instances).length) await setInstances(instances);
await setSettings(OFF);

console.log(
  SHOTS
    ? `capturing to ${OUT}`
    : `live preview in a browser window — Ctrl-C to close\n`,
);

try {
  for (const job of jobs) {
    await setHostSettings(job.skin ? { [job.host]: job.skin } : {});
    const page = await context.newPage();
    console.log(`  ${job.label.padEnd(20)} ${job.url}`);
    await retry(() =>
      page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
    );
    await page.waitForSelector(job.ready, { timeout: 30000 }).catch(() => {});
    // Content, not just chrome — see the note on `settled` above.
    await page.waitForSelector(job.settled, { timeout: 30000 }).catch(() => {});
    if (job.skin) await waitForTheme(page, job.skin).catch(() => {});
    else await waitForNoTheme(page).catch(() => {});
    // A client-rendered app settles after its shell, and the structural passes
    // re-orient the navigation after that; capturing earlier shows a page no
    // one would ever see.
    await page.waitForTimeout(SETTLE);

    if (SHOTS) {
      const file = join(OUT, `${job.label}.png`);
      await writeFile(file, await page.screenshot());
      console.log(`    -> ${file}`);
    }
    if (HOLD) {
      await page.bringToFront();
      // Hold each frame so it can be looked at, not just captured.
      await page.waitForTimeout(ONLY ? 0 : 9000);
    }
    if (!HOLD) await page.close();
  }
} catch (error) {
  console.error(`\npreview failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (HOLD && !process.exitCode) {
    console.log('\nholding the window open — Ctrl-C to close.');
    await new Promise(() => {});
  }
  await close();
}
