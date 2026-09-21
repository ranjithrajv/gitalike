#!/usr/bin/env node
/**
 * Independent semantic judge for the skin parity, over TypeSafe's Jev model.
 *
 * Three things measure a skin, and they are deliberately different. The rubric
 * (`parity-score.mjs`) scores what the skin *builds*, derived from the tables.
 * The offline matcher (`parity-style.mjs`) reduces each capture to a
 * design-language fingerprint (bar / accent class) and asks which product it is
 * nearest. This is the third read: the same captures, described by their
 * measured chrome, are given to a semantic judge alongside the target products'
 * own chrome, and it identifies and scores them. It is how the design-language
 * anchor was chosen (see the note at the top of `parity-style.mjs`) and it is
 * what the "Independent judge" section of `docs/UX-PARITY.md` quotes.
 *
 * The state is curated, not measured — the judge reads text, not pixels — so it
 * lives in `tests/fixtures/parity-judge.json` next to the recorded answers, and
 * `tests/compare/parity-judge.test.mjs` pins the docs to it. This tool only
 * re-runs the fixture against the API.
 *
 *   node tools/compare/parity-judge.mjs          recorded + fresh verdict
 *   node tools/compare/parity-judge.mjs --json   machine-readable answers
 *
 * Needs `TYPESAFE_API_KEY` and network, so it is on-demand, not a commit gate.
 * `GS_JUDGE_MODEL` (or the fixture's `model`) picks the model.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FIXTURE = JSON.parse(
  readFileSync(join(root, 'tests/fixtures/parity-judge.json'), 'utf8'),
);

export const DIRECTIONS = FIXTURE.directions;
export const API_URL = 'https://api.typesafe.ai/v1/systemone';

/** The state one direction is judged against: the targets plus its capture. */
export function stateFor(direction) {
  return {
    targets: FIXTURE.targets,
    target: direction.target,
    source: direction.source,
    page: direction.page,
    observed: direction.observed,
  };
}

/** The typed questions, batched so they run in parallel in one call. */
export function questionsFor(direction) {
  const { id, target, source } = direction;
  return {
    [`${id}__reads_as`]: {
      type: 'choice',
      instructions: `The page is a ${source} project shown with GitAlike's ${target}. Using only the observed facts and the target definitions, which product's UI does the page read as?`,
      criteria: {
        github:
          "GitHub UI: dark bar, horizontal tab row, right-hand About sidebar, GitHub's repo words",
        gitlab:
          "GitLab UI: light bar, vertical grouped sidebar, full-width Project information block, GitLab's repo words",
        bitbucket:
          'Bitbucket UI: blue bar, flat vertical sidebar, Source/Pull requests/Pipelines',
        none: 'none of the three; broken or mixed beyond recognition',
      },
    },
    [`${id}__fidelity`]: {
      type: 'score',
      instructions: `How closely does this page reproduce the UI of GitAlike's ${target}, judging only the chrome, navigation, words and metadata placement shown?`,
      criteria: [
        "0: does not read as the target at all; the source's own chrome is unchanged.",
        "2: only the palette hints at the target; navigation, words and metadata are still the source's.",
        "4: palette and some words match, but the navigation shape and metadata placement are the source's.",
        "6: palette, navigation orientation and most words match; the metadata block or several labels are still the source's.",
        '8: palette, orientation, grouping, words and metadata all match, with at most one visible mismatch.',
        "10: indistinguishable from the target product's own chrome; no visible mismatch.",
      ],
    },
    [`${id}__recognisable`]: {
      type: 'noul',
      instructions: `The target product is ${target}. Would a frequent ${target} user, landing on this page, recognise its chrome/navigation as ${target}? Judge only the chrome, navigation shape, words and metadata placement; ignore the repository's content.`,
      criteria: {
        true: "yes, it reads as the target product's UI",
        false: "no, it does not read as the target product's UI",
      },
    },
    [`${id}__top_bar_words`]: {
      type: 'choice',
      instructions: `The global top bar is part of the imitated product's surface. The applied target is ${target}; the source product is ${source}. Whose navigation words does the top bar show?`,
      criteria: {
        applied: "the applied target product's own top-bar words",
        source: "the source product's own top-bar words, repainted",
        mixed: 'a mix, or no clear attribution',
      },
    },
    [`${id}__tells`]: {
      type: 'noul',
      instructions: `The underlying page is a ${source} project. Does the observed chrome contain a visible tell that reveals the source product rather than the applied ${target}? (e.g. a source-only feature name, the source's own top-bar words, or a source-only control.)`,
      criteria: {
        true: 'yes, a source tell is visible',
        false: 'no, nothing reveals the source',
      },
    },
    [`${id}__weakest`]: {
      type: 'choice',
      instructions:
        'Which single surface most weakens the illusion that this page is the target product, given the source page underneath?',
      criteria: {
        top_bar_words:
          "the global top bar still shows the SOURCE product's own navigation words / CTA",
        repo_nav: "the repository navigation's shape, grouping or labels",
        metadata: 'the metadata block, its placement or its heading',
        palette: 'the colours / brand mark',
        content_tells:
          'source-only feature names in the content (e.g. Environments, Custom properties, Code owners)',
        none: 'nothing material; it is convincing',
      },
    },
  };
}

/**
 * The score type returns a mean *legend index*. Interpolate the legend's own
 * numeric prefixes (0, 2, 4, …) so the result is on the 0–10 scale the docs
 * quote, whatever levels the rubric uses.
 */
export function scoreToTen(answer) {
  const keys = Object.keys(answer.legend).sort((a, b) => Number(a) - Number(b));
  const values = keys.map((key) =>
    Number(String(answer.legend[key]).match(/^\s*(\d+)/)?.[1] ?? NaN),
  );
  const index = answer.score;
  const lo = Math.floor(index);
  const hi = Math.min(lo + 1, values.length - 1);
  return values[lo] + (values[hi] - values[lo]) * (index - lo);
}

/** Ask the judge one direction. Throws when the key is missing or the API errs. */
export async function judge(direction, { model, key } = {}) {
  const apiKey = key ?? process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY is not set');
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      state: stateFor(direction),
      model: model ?? process.env.GS_JUDGE_MODEL ?? FIXTURE.model,
      questions: questionsFor(direction),
    }),
  });
  if (!response.ok) {
    throw new Error(`Jev HTTP ${response.status} — ${await response.text()}`);
  }
  const out = await response.json();
  return { model: out.model, answers: out.answers };
}

/* ------------------------------------------------------------------- cli -- */

const fmt = (n, digits = 2) => Number(n).toFixed(digits);

async function main() {
  const asJson = process.argv.includes('--json');
  const results = [];
  for (const direction of DIRECTIONS) {
    try {
      results.push({ direction, ...(await judge(direction)) });
    } catch (error) {
      console.error(`${direction.id}: ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  for (const { direction, model, answers } of results) {
    const a = answers;
    console.log(
      `\n${direction.id} — ${direction.source} page wearing the ${direction.target}`,
    );
    console.log(`  capture          ${direction.capture}`);
    console.log(`  reads as         ${a[`${direction.id}__reads_as`].choice}`);
    console.log(
      `  fidelity         ${fmt(scoreToTen(a[`${direction.id}__fidelity`]))}/10`,
    );
    console.log(
      `  recognisable     ${fmt(a[`${direction.id}__recognisable`].noul)}`,
    );
    console.log(
      `  top-bar words    ${a[`${direction.id}__top_bar_words`].choice}`,
    );
    console.log(`  source tell      ${fmt(a[`${direction.id}__tells`].noul)}`);
    console.log(
      `  weakest surface  ${a[`${direction.id}__weakest`].choice}  (${model})`,
    );
    const recorded = direction.recorded;
    console.log(
      `  recorded         reads as ${recorded.reads_as}, ` +
        `fidelity ${fmt(recorded.fidelity, 1)}/10, ` +
        `recognisable ${fmt(recorded.recognisable)}, ` +
        `weakest ${recorded.weakest}`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
