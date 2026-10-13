/**
 * Popup palette contrast.
 *
 * `tests/skin-contrast.test.mjs` covers the skins. The popup is a separate
 * surface with its own `:root` pair of palettes, and it was not in that suite's
 * scope — which is how the same defect the skins were fixed for survived here:
 * `.why__dismiss` paired a hardcoded `color: #ffffff` with `background:
 * var(--accent)`, so the label was legible in light mode (5.19:1) and not in
 * dark (3.75:1). The fix is a label token per mode, exactly as the skins do it.
 *
 * A literal is the thing to catch, not the value: `#ffffff` is the *correct*
 * light label, and it is the wrong dark one. So the assertions are that a
 * label is a token, and that the token pair clears AA in both modes — which
 * fails on reintroduction of the literal, because the literal cannot flip.
 *
 * The second half of the audit — that the `max-width: 360px` block lifts
 * `main`'s height cap for the full-screen context — was **dropped, not fixed**,
 * because measuring it contradicted the premise. A browser sizes a toolbar
 * popup to the document's *preferred* width, which is `body { width: 322px }`;
 * so the 360px block matches on desktop as well as on a phone, and lifting the
 * cap inside it would remove the desktop scroll region and let the popup grow
 * past the height a browser allows, clipping its own footer. A width media
 * query cannot separate the two contexts — both are narrow; only the height
 * differs. Rescoping the block changes desktop presentation, so it is left to
 * the owner rather than taken here.
 *
 *   npm test
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** WCAG AA for body text. An 11px button label is body text, not large text. */
const AA = 4.5;

const CSS = readFileSync(
  fileURLToPath(new URL('../src/popup/popup.css', import.meta.url)),
  'utf8',
);
/** Comments stripped, so a token named in prose is not read as a declaration. */
const SOURCE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const DARK_AT = SOURCE.indexOf('@media (prefers-color-scheme: dark)');

/**
 * The custom properties one `:root` block declares. The light palette is the
 * block before the dark media query, the dark palette the one inside it.
 * @param {'light'|'dark'} mode
 * @returns {Record<string, string>}
 */
function palette(mode) {
  const scope =
    mode === 'dark' ? SOURCE.slice(DARK_AT) : SOURCE.slice(0, DARK_AT);
  const block = /:root\s*\{([^}]*)\}/.exec(scope);
  assert.ok(block, `popup.css has a ${mode} :root block`);
  const tokens = {};
  for (const line of block[1].split('\n')) {
    const match = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (match) tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

/** WCAG 2.x relative luminance of a `#rrggbb` string. */
function luminance(value) {
  const channels = [1, 3, 5].map((i) => {
    const channel = parseInt(value.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio between two `#rrggbb` strings. */
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The `color:` values written as a literal rather than a `var(--…)`. */
const literalLabels = () =>
  [...SOURCE.matchAll(/(?<![\w-])color\s*:\s*([^;]+);/g)]
    .map((match) => match[1].trim())
    .filter((value) => !value.startsWith('var('));

describe('popup palette contrast', () => {
  test('a label token is declared in both modes', () => {
    // The gap that let the defect through: `--accent` flips, so whatever labels
    // it has to flip with it, or one of the two modes is unreadable.
    for (const mode of ['light', 'dark']) {
      const tokens = palette(mode);
      assert.ok(tokens['--accent'], `--accent is declared in ${mode}`);
      assert.ok(
        tokens['--on-accent'],
        `--on-accent is declared in ${mode}, so the label can flip with the fill`,
      );
    }
  });

  test('the accent label clears AA on the accent fill in both modes', () => {
    for (const mode of ['light', 'dark']) {
      const tokens = palette(mode);
      const ratio = contrast(tokens['--on-accent'], tokens['--accent']);
      assert.ok(
        ratio >= AA,
        `${mode}: ${tokens['--on-accent']} on ${tokens['--accent']} is ${ratio.toFixed(2)}:1, below AA (${AA}:1)`,
      );
    }
  });

  test('no rule writes a literal colour as a label', () => {
    // This is what fails on reintroduction: reverting `.why__dismiss` to
    // `color: #ffffff` puts a literal back, and a literal cannot flip with the
    // mode no matter which value it is.
    assert.deepEqual(
      literalLabels(),
      [],
      'every `color:` in popup.css reads a token, so it flips with its fill',
    );
  });

  test('the label token is actually used, not just declared', () => {
    // A declared-but-unused token would satisfy the pair checks above while the
    // rule it was declared for went on hardcoding its own label.
    assert.match(
      SOURCE,
      /\.why__dismiss\s*\{[^}]*color:\s*var\(--on-accent\)/,
      '.why__dismiss labels itself from --on-accent',
    );
  });
});
