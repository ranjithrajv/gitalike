/**
 * The independent judge run quoted in docs/UX-PARITY.md, pinned to the fixture
 * that `tools/compare/parity-judge.mjs` re-runs against the TypeSafe API.
 *
 * The API needs a key and network, so the tool is on-demand; this is the offline
 * half — it checks the fixture is well-formed, that the recorded answers agree
 * with the questions asked, and that the docs quote them. The state is curated
 * by hand, so this cannot re-derive it; it can only keep the three copies (the
 * fixture, the tool's questions, the docs) from drifting apart.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  DIRECTIONS,
  stateFor,
  questionsFor,
  scoreToTen,
} from '../../tools/compare/parity-judge.mjs';

const doc = readFileSync(
  new URL('../../docs/UX-PARITY.md', import.meta.url),
  'utf8',
);
const SKINS = new Set(['github', 'gitlab', 'bitbucket']);
const close = (a, b, tolerance = 0.05) => Math.abs(a - b) <= tolerance;

describe('parity judge fixture', () => {
  test('every direction is a real, described source × skin pair', () => {
    assert.ok(DIRECTIONS.length >= 2, 'at least the two headline directions');
    for (const d of DIRECTIONS) {
      for (const key of [
        'id',
        'source',
        'skin',
        'target',
        'page',
        'capture',
        'observed',
      ]) {
        assert.ok(String(d[key] ?? '').trim(), `${d.id ?? '?'} has ${key}`);
      }
      assert.ok(SKINS.has(d.skin), `${d.id}: unknown skin ${d.skin}`);
      assert.notEqual(d.source, d.skin, `${d.id} is a cross-skin`);
      assert.ok(
        existsSync(new URL(`../../${d.capture}`, import.meta.url)),
        `${d.id}: ${d.capture} exists`,
      );
    }
  });

  test('the recorded verdict names the applied skin, within range', () => {
    for (const { id, skin, recorded } of DIRECTIONS) {
      assert.equal(recorded.reads_as, skin, `${id} reads as its target`);
      assert.ok(
        recorded.fidelity > 0 && recorded.fidelity <= 10,
        `${id} fidelity in (0, 10]`,
      );
      for (const key of ['recognisable', 'tells']) {
        assert.ok(
          recorded[key] >= 0 && recorded[key] <= 1,
          `${id} ${key} is a probability`,
        );
      }
    }
  });

  test('the recorded score is the question rubric’s own scale', () => {
    for (const d of DIRECTIONS) {
      const levels = questionsFor(d)[`${d.id}__fidelity`].criteria;
      const legend = Object.fromEntries(levels.map((text, i) => [i, text]));
      assert.ok(
        close(
          scoreToTen({ score: d.recorded.fidelityIndex, legend }),
          d.recorded.fidelity,
        ),
        `${d.id}: fidelityIndex maps to the recorded fidelity`,
      );
    }
  });

  test('the state and questions are complete', () => {
    for (const d of DIRECTIONS) {
      const state = stateFor(d);
      assert.ok(state.targets.length > 0);
      assert.equal(state.observed, d.observed);
      const questions = questionsFor(d);
      const types = new Set(['noul', 'choice', 'score']);
      for (const [key, question] of Object.entries(questions)) {
        assert.ok(key.startsWith(d.id), `${key} is namespaced by id`);
        assert.ok(types.has(question.type), `${key} has a known type`);
        assert.ok(question.instructions.length > 0, `${key} has instructions`);
      }
    }
  });

  test('docs/UX-PARITY.md quotes the recorded run', () => {
    const heading = '### Independent judge';
    const start = doc.indexOf(heading);
    assert.notEqual(start, -1, 'the judge section exists');
    const section = doc.slice(start, doc.indexOf('\n## ', start));
    for (const { capture, recorded } of DIRECTIONS) {
      assert.ok(section.includes(capture), `quotes ${capture}`);
      assert.ok(
        section.includes(recorded.fidelity.toFixed(1)),
        `quotes ${capture}'s fidelity`,
      );
    }
  });
});
