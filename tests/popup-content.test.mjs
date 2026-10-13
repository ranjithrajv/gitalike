/**
 * Popup content shape.
 *
 * The popup offers one decision — which UI a page wears — and it used to offer
 * it twice: the global picker and the per-site picker were built from the same
 * `THEMES` list, so a host the extension knows rendered eight radio inputs for
 * four distinct choices, and the global picker's sub-labels were three
 * near-identical lines of the same four hostnames (170 characters, a quarter of
 * everything the popup said).
 *
 * The per-site override is the exception, so it discloses; and it stays in the
 * mark-up — it is `hidden`, not removed, and the tests below hold that line
 * rather than asserting the list is gone. What must not come back is the
 * *duplication on screen* and the hostname list, which is what these assert.
 *
 * `tests/popup-contrast.test.mjs` covers the other half of the audit.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) =>
  readFileSync(
    fileURLToPath(new URL(`../src/popup/${name}`, import.meta.url)),
    'utf8',
  );

const HTML = read('popup.html');
const JS = read('popup.js');

/** The `disabled`-style attribute on an element, matched by its id. */
const opensWith = (id) =>
  new RegExp(`<[^>]*id="${id}"[^>]*>`).exec(HTML)?.[0] ?? '';

describe('popup content', () => {
  test('the per-site picker is disclosed, not shown beside the global one', () => {
    // The whole point: the same four choices must not be on screen twice. The
    // body carries `hidden` in the mark-up, so the first paint has one list.
    assert.match(
      opensWith('site-body'),
      /\bhidden\b/,
      '#site-body starts hidden, so the option list is not duplicated on screen',
    );
  });

  test('the disclosure is announced, and its target exists', () => {
    const toggle = opensWith('site-toggle');
    assert.match(toggle, /aria-expanded="false"/, 'collapsed on first paint');
    assert.match(
      toggle,
      /aria-controls="site-body"/,
      'names the body it opens',
    );
    assert.match(opensWith('site-body'), /id="site-body"/, 'the target exists');
  });

  test('both disclosures are wired to a real target', () => {
    // `aria-controls` pointing at nothing is a control that lies to assistive
    // tech. Cheap to check, so every one in the file is.
    const controls = [...HTML.matchAll(/aria-controls="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(controls.length >= 2, 'the file has disclosures');
    for (const id of controls) {
      assert.match(
        HTML,
        new RegExp(`id="${id}"`),
        `aria-controls="${id}" resolves to an element`,
      );
    }
  });

  test('the global picker names a count, not the hostnames', () => {
    // The list was the single largest block of text in the popup. A count
    // answers the same question — how much would change — in a fifth of it.
    assert.doesNotMatch(
      JS,
      /hosts\.join\(/,
      'the skin sub-label no longer joins the hostnames',
    );
    assert.match(
      JS,
      /skin__hosts['"]\)\.textContent/,
      'the sub-label is still written from the host list',
    );
  });

  test('the per-site picker still exists, and still offers every skin', () => {
    // Guarding the other direction: "not duplicated" must not have been
    // achieved by deleting the override. Both groups are built from the one
    // shared table, so a new skin reaches both without an edit here.
    assert.match(JS, /buildRadios\(skinOptions/, 'the global group is built');
    assert.match(JS, /buildRadios\(siteOptions/, 'the per-site group is built');
    assert.match(
      opensWith('site-options'),
      /role="radiogroup"/,
      'the per-site group keeps its role',
    );
  });
});
