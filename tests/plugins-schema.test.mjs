/**
 * `plugins.schema.json` is the published contract for the registry; this pins it
 * to what the code actually derives, so the schema cannot drift from
 * `plugins.json`. It validates both the freshly derived registry and the
 * committed file with a small, standard-library-only walk of the keywords the
 * schema uses — no validator dependency.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../tools/plugins.mjs';
import { registryObject } from '../tools/registry.mjs';

const read = (path) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));

const schema = read('plugins.schema.json');

const typeOf = (value) =>
  Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;

/** The errors `value` has against `node`, named by path. Empty means valid. */
function validate(value, node, path = '$') {
  const errors = [];
  const types = Array.isArray(node.type)
    ? node.type
    : node.type
      ? [node.type]
      : [];
  if (types.length) {
    const actual = typeOf(value);
    const ok = types.some(
      (want) =>
        want === actual || (want === 'integer' && Number.isInteger(value)),
    );
    if (!ok) return [`${path}: expected ${types.join('|')}, got ${actual}`];
  }
  if (node.enum && !node.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in ${node.enum}`);
  }
  if (typeof value === 'string') {
    if (node.minLength != null && value.length < node.minLength) {
      errors.push(`${path}: shorter than ${node.minLength}`);
    }
    if (node.pattern && !new RegExp(node.pattern).test(value)) {
      errors.push(`${path}: does not match ${node.pattern}`);
    }
    if (node.format === 'uri' && !/^https?:\/\//.test(value)) {
      errors.push(`${path}: not a URI`);
    }
  }
  if (typeof value === 'number') {
    if (node.minimum != null && value < node.minimum) {
      errors.push(`${path}: below ${node.minimum}`);
    }
    if (node.maximum != null && value > node.maximum) {
      errors.push(`${path}: above ${node.maximum}`);
    }
  }
  if (Array.isArray(value)) {
    if (node.uniqueItems) {
      const seen = new Set(value.map((item) => JSON.stringify(item)));
      if (seen.size !== value.length) errors.push(`${path}: items not unique`);
    }
    if (node.items) {
      value.forEach((item, index) =>
        errors.push(...validate(item, node.items, `${path}[${index}]`)),
      );
    }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of node.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required '${key}'`);
    }
    for (const [key, sub] of Object.entries(node.properties ?? {})) {
      if (key in value)
        errors.push(...validate(value[key], sub, `${path}.${key}`));
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(node.properties ?? {}, key)) {
          errors.push(`${path}: unexpected '${key}'`);
        }
      }
    }
  }
  return errors;
}

describe('plugins.schema.json', () => {
  test('is a JSON Schema document', () => {
    assert.match(schema.$schema, /json-schema\.org\/draft\/2020-12/);
    assert.equal(schema.type, 'object');
    assert.deepEqual(schema.required, ['apiVersion', 'skins', 'sources']);
  });

  test('validates the derived registry', () => {
    const errors = validate(registryObject(), schema);
    assert.deepEqual(errors, [], errors.join('\n'));
  });

  test('validates the committed plugins.json', () => {
    const errors = validate(read('plugins.json'), schema);
    assert.deepEqual(errors, [], errors.join('\n'));
  });
});
