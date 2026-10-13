/**
 * Popup content shape.
 *
 * The popup asks one question — which UI a page wears — and it used to ask it
 * twice: a global picker and a per-site picker, both built from the same
 * `THEMES` list, so a host the extension knew rendered eight radio inputs for
 * four distinct choices. The global picker's sub-labels were three
 * near-identical lines naming the same four hostnames (170 characters, a
 * quarter of everything the popup said), reduced to a count, and now gone.
 *
 * The per-site picker was disclosed, then dropped outright: a skin applies to
 * every source, `settingsForSkin` writes it to every kind, so there is nothing
 * for a second list to say that the first has not. What a per-site choice still
 * affords — switching one host off and on — is `Alt`+`Shift`+`G`, which does not
 * need a list of four to do it.
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
const CSS = read('popup.css');
const JS = read('popup.js');

/** The opening tag of the element with this id. */
const tagFor = (id) =>
  new RegExp(`<[^>]*id="${id}"[^>]*>`).exec(HTML)?.[0] ?? '';

describe('popup content', () => {
  test('the skin is chosen once, not once per scope', () => {
    // The requirement in one assertion: one radio group in the popup, offering
    // every skin. A second group is the regression this file exists to stop.
    const groups = [...HTML.matchAll(/role="radiogroup"/g)].length;
    assert.equal(groups, 1, 'the popup has exactly one radio group');

    // And the builder is called for that one group only. The definition is
    // removed first so the count is of call sites, not of `function`.
    const calls =
      JS.replace(/function buildRadios\([^)]*\)/, '').match(/buildRadios\(/g) ??
      [];
    assert.equal(calls.length, 1, 'buildRadios is called once');
    assert.match(JS, /buildRadios\(skinOptions/, 'for the one group');
    for (const name of ['gs-site-skin', 'site__options', 'site-toggle']) {
      assert.doesNotMatch(
        `${HTML}${CSS}${JS}`,
        new RegExp(name),
        `${name} is gone`,
      );
    }
  });

  test('the group renders the off choice last, after every skin', () => {
    // Built from the shared `table`, so a new skin reaches it without an edit
    // here — and `Off` is appended rather than written into the list, which is
    // what kept it last when the per-site group wanted it first.
    assert.match(JS, /SITES\.THEMES\.map/, 'the skins come from the registry');
    assert.match(JS, /choices\.push\(\{ value: 'off'/, 'Off is appended last');
  });

  test('every disclosure is wired to a real target', () => {
    // `aria-controls` pointing at nothing is a control that lies to assistive
    // tech. One disclosure is left (`Add a site`), and it is checked.
    const controls = [...HTML.matchAll(/aria-controls="([^"]+)"/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(
      controls,
      ['add-body'],
      'the add disclosure is the one left',
    );
    for (const id of controls) {
      assert.match(
        HTML,
        new RegExp(`id="${id}"`),
        `aria-controls="${id}" resolves`,
      );
    }
    assert.match(
      tagFor('add-toggle'),
      /aria-expanded="false"/,
      'and starts collapsed',
    );
  });

  test('an option row is the product name, and nothing else', () => {
    // The sub-label here has been through two shapes: the hosts the skin would
    // change, spelled out, then a count of them. Both answered "how much would
    // this change" and neither earned a second line, so the row is the name.
    // The host list still decides the marker a row carries — a separate
    // question, answered by a border rather than by prose.
    for (const [name, source] of [
      ['popup.js', JS],
      ['popup.css', CSS],
      ['popup.html', HTML],
    ]) {
      assert.doesNotMatch(
        source,
        /skin__hosts/,
        `${name} has no host sub-label`,
      );
    }
    assert.doesNotMatch(
      JS,
      /hosts\.join\(/,
      'hostnames are not joined anywhere',
    );
    assert.match(
      JS,
      /hosts\.includes\(host\)/,
      'the host list still decides the marker',
    );
  });
});
