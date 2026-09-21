/**
 * Unit tests for src/lib/sites.js — the one piece of gitalike that is pure,
 * side-effect-free logic and therefore worth locking down.
 *
 * Runs on Node's built-in test runner, so the project keeps its zero-dependency
 * stance:
 *
 *   npm test        # or: node --test
 *
 * The module under test is a classic script that publishes itself on
 * `globalThis.GITALIKE`; importing it for its side effect is all that is needed.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import '../src/lib/sites.js';

const SITES = globalThis.GITALIKE;
const {
  parseHost,
  kindFor,
  hostsFor,
  isBuiltin,
  isHostname,
  isKind,
  kindOn,
  hostSkinFor,
  sourceFor,
  themeFor,
  globalSkin,
  settingsForSkin,
  hostsForSkin,
  stateFrom,
  kinds,
  skins,
  THEMES,
  SETTINGS_KEY,
  INSTANCES_KEY,
  HOST_SETTINGS_KEY,
  STORAGE_KEYS,
} = SITES;

describe('module shape', () => {
  test('publishes the shared surface on globalThis', () => {
    assert.equal(typeof SITES, 'object');
    for (const fn of [
      parseHost,
      kindFor,
      hostsFor,
      isBuiltin,
      isHostname,
      isKind,
      kindOn,
      hostSkinFor,
      sourceFor,
      themeFor,
      globalSkin,
      settingsForSkin,
      hostsForSkin,
      stateFrom,
    ]) {
      assert.equal(typeof fn, 'function');
    }
  });

  test('the storage schema and skin list are the shared ones', () => {
    assert.deepEqual(STORAGE_KEYS, [
      SETTINGS_KEY,
      INSTANCES_KEY,
      HOST_SETTINGS_KEY,
    ]);
    assert.equal(SETTINGS_KEY, 'gitSameSettings');
    assert.equal(INSTANCES_KEY, 'gitSameInstances');
    assert.equal(HOST_SETTINGS_KEY, 'gitSameHostSettings');
    // Derived from `skins`, so a new skin is listed exactly once.
    assert.deepEqual(THEMES, ['gitlab', 'github', 'bitbucket']);
  });

  test('a kind is always skinned with the *other* product by default', () => {
    assert.equal(kinds.github.theme, 'gitlab');
    assert.equal(kinds.gitlab.theme, 'github');
    // There is no single "other" product for a third kind; Bitbucket and
    // Gerrit default to the GitHub UI.
    assert.equal(kinds.bitbucket.theme, 'github');
    assert.equal(kinds.gerrit.theme, 'github');
  });

  test('every skin names the product whose UI it is, and its layout', () => {
    for (const theme of THEMES) {
      assert.equal(typeof skins[theme].product, 'string');
      assert.equal(typeof skins[theme].badge, 'string');
      assert.match(skins[theme].color, /^#[0-9a-f]{6}$/i);
      assert.ok(['github', 'gitlab'].includes(skins[theme].layout), theme);
    }
    assert.equal(skins.gitlab.product, 'GitLab');
    assert.equal(skins.github.product, 'GitHub');
    assert.equal(skins.bitbucket.product, 'Bitbucket');
    // Bitbucket's repo nav is a left sidebar, so it reuses GitLab's shape.
    assert.equal(skins.bitbucket.layout, 'gitlab');
  });
});

describe('parseHost — accepted input', () => {
  // The README promises this table: bare hosts, full URLs, paths, ports, mixed
  // case, trailing dots, whitespace and trailing slashes all normalise to a
  // bare lowercase hostname. A port or path is dropped: it could never match
  // location.hostname.
  const table = [
    ['github.acme.com', 'github.acme.com'],
    ['  github.acme.com  ', 'github.acme.com'],
    ['GitHub.Acme.com', 'github.acme.com'],
    ['github.acme.com.', 'github.acme.com'],
    ['github.acme.com/', 'github.acme.com'],
    ['github.acme.com/pulls', 'github.acme.com'],
    ['github.acme.com?x=1', 'github.acme.com'],
    ['github.acme.com#frag', 'github.acme.com'],
    ['github.acme.com:8443', 'github.acme.com'],
    ['https://GitHub.Acme.com/pulls?q=1', 'github.acme.com'],
    ['http://gitlab.example.com', 'gitlab.example.com'],
    ['https://GitHub.Acme.com:8443/path', 'github.acme.com'],
    ['HTTP://GITHUB.ACME.COM', 'github.acme.com'],
    // Built-in hosts are still *valid* addresses — the popup refuses them
    // separately via isBuiltin(), not here.
    ['github.com', 'github.com'],
  ];

  for (const [input, expected] of table) {
    test(`${JSON.stringify(input)} -> ${expected}`, () => {
      assert.equal(parseHost(input), expected);
    });
  }
});

describe('parseHost — refused input', () => {
  // Anything that is not an http(s) web address must come back null rather than
  // be stored: javascript:, ftp:, protocol-relative and malformed strings.
  const refused = [
    '',
    '   ',
    null,
    undefined,
    'not a host',
    'javascript:alert(1)',
    'javascript://alert(1)',
    'ftp://files.example.com',
    'ftp:files.example.com',
    '//github.acme.com',
    'https://',
    'https://:8080',
    'https://github.acme.com:notaport',
  ];

  for (const input of refused) {
    test(`${JSON.stringify(input)} -> null`, () => {
      assert.equal(parseHost(input), null);
    });
  }
});

describe('kindFor', () => {
  test('knows the bundled hosts', () => {
    assert.equal(kindFor('github.com'), 'github');
    assert.equal(kindFor('gitlab.com', {}), 'gitlab');
    // GitHub-flavoured forges: the github kind, shown with the GitLab UI.
    assert.equal(kindFor('codeberg.org', {}), 'github');
    assert.equal(kindFor('gitea.com', {}), 'github');
    // Bitbucket is a source too, so its own host is the bitbucket kind. Gerrit
    // has no bundled host, so it is only ever added by the user.
    assert.equal(kindFor('bitbucket.org', {}), 'bitbucket');
    assert.equal(kindFor('gerrit.example.com', {}), null);
    // A self-hosted instance is not bundled; it is added by the user.
    assert.equal(kindFor('code.swecha.org', {}), null);
  });

  test('falls back to the user-added map', () => {
    const added = { 'github.acme.com': 'github', 'gl.acme.com': 'gitlab' };
    assert.equal(kindFor('github.acme.com', added), 'github');
    assert.equal(kindFor('gl.acme.com', added), 'gitlab');
    assert.equal(
      kindFor('bb.acme.com', { 'bb.acme.com': 'bitbucket' }),
      'bitbucket',
    );
    assert.equal(
      kindFor('cr.example.com', { 'cr.example.com': 'gerrit' }),
      'gerrit',
    );
  });

  test('returns null for hosts it has never seen', () => {
    assert.equal(kindFor('example.com', {}), null);
    assert.equal(kindFor('github.acme.com', {}), null);
    assert.equal(kindFor('github.com', null), 'github'); // builtin needs no map
  });

  test('ignores junk stored against a host', () => {
    assert.equal(
      kindFor('evil.example', { 'evil.example': 'gitbucket' }),
      null,
    );
    assert.equal(kindFor('evil.example', { 'evil.example': null }), null);
  });

  test('the bundled table wins over anything the user stored', () => {
    assert.equal(kindFor('github.com', { 'github.com': 'gitlab' }), 'github');
    assert.equal(kindFor('gitlab.com', { 'gitlab.com': 'github' }), 'gitlab');
  });
});

describe('hostsFor', () => {
  test('lists the bundled hosts, user hosts after', () => {
    assert.deepEqual(hostsFor('github', {}), [
      'github.com',
      'codeberg.org',
      'gitea.com',
    ]);
    assert.deepEqual(hostsFor('gitlab', {}), ['gitlab.com']);
    assert.deepEqual(hostsFor('gitlab', { 'gl.acme.com': 'gitlab' }), [
      'gitlab.com',
      'gl.acme.com',
    ]);
    assert.deepEqual(hostsFor('bitbucket', {}), ['bitbucket.org']);
    assert.deepEqual(hostsFor('bitbucket', { 'bb.acme.com': 'bitbucket' }), [
      'bitbucket.org',
      'bb.acme.com',
    ]);
  });

  test('never duplicates a host and never mixes kinds', () => {
    assert.deepEqual(hostsFor('github', { 'github.com': 'github' }), [
      'github.com',
      'codeberg.org',
      'gitea.com',
    ]);
    assert.deepEqual(
      hostsFor('github', { 'gl.acme.com': 'gitlab', 'gh.acme.com': 'github' }),
      ['github.com', 'codeberg.org', 'gitea.com', 'gh.acme.com'],
    );
  });

  test('tolerates a missing added map and junk values', () => {
    assert.deepEqual(hostsFor('github', null), [
      'github.com',
      'codeberg.org',
      'gitea.com',
    ]);
    assert.deepEqual(hostsFor('github', { 'x.example': 'nonsense' }), [
      'github.com',
      'codeberg.org',
      'gitea.com',
    ]);
  });

  test('ignores stored keys that are not bare hostnames', () => {
    // A synced instances map is user data. A wildcard key would otherwise be
    // handed to scripting.registerContentScripts and re-broaden injection.
    assert.deepEqual(
      hostsFor('github', {
        '*': 'github',
        '*.corp.example': 'github',
        'evil.com/path': 'github',
        'evil.com:8080': 'github',
        'ok.example': 'github',
      }),
      ['github.com', 'codeberg.org', 'gitea.com', 'ok.example'],
    );
  });
});

describe('isHostname', () => {
  test('accepts a bare hostname', () => {
    for (const host of [
      'github.com',
      'code.swecha.org',
      'github.acme.com',
      '127.0.0.1',
      'localhost',
      'my_host.example',
      'a-b.c-d.example',
    ]) {
      assert.equal(isHostname(host), true, host);
    }
  });

  test('refuses anything that is not a bare host', () => {
    for (const host of [
      '',
      '*',
      '*.example.com',
      '*://*/*',
      'evil.com/path',
      'evil.com:8080',
      ' evil.com',
      'evil.com ',
      'evil.com?x=1',
      'evil.com#frag',
      'https://evil.com',
      'javascript:alert(1)',
      // Valid-looking but name an object property.
      '__proto__',
      'constructor',
      'prototype',
      null,
      undefined,
      42,
    ]) {
      assert.equal(isHostname(host), false, String(host));
    }
  });
});

describe('isBuiltin / isKind', () => {
  test('recognises the bundled hosts and only those', () => {
    assert.equal(isBuiltin('github.com'), true);
    assert.equal(isBuiltin('gitlab.com'), true);
    assert.equal(isBuiltin('code.swecha.org'), false);
    assert.equal(isBuiltin('codeberg.org'), true);
    assert.equal(isBuiltin('gitea.com'), true);
    assert.equal(isBuiltin('bitbucket.org'), true);
    assert.equal(isBuiltin('github.acme.com'), false);
    // Guard against prototype-key false positives.
    assert.equal(isBuiltin('constructor'), false);
  });

  test('accepts exactly the known kinds', () => {
    assert.equal(isKind('github'), true);
    assert.equal(isKind('gitlab'), true);
    assert.equal(isKind('bitbucket'), true);
    assert.equal(isKind('gerrit'), true);
    assert.equal(isKind('gitbucket'), false);
    assert.equal(isKind(''), false);
    assert.equal(isKind(null), false);
  });
});

describe('stateFrom', () => {
  test('applies the defaults for a first run', () => {
    assert.deepEqual(stateFrom(undefined), {
      settings: {},
      instances: {},
      hostSettings: {},
    });
    assert.deepEqual(stateFrom({}), {
      settings: {},
      instances: {},
      hostSettings: {},
    });
  });

  test('reads the three maps under their shared keys', () => {
    const stored = {
      [SETTINGS_KEY]: { github: 'gitlab' },
      [INSTANCES_KEY]: { 'gh.acme.com': 'github' },
      [HOST_SETTINGS_KEY]: { 'gh.acme.com': 'off' },
    };
    assert.deepEqual(stateFrom(stored), {
      settings: { github: 'gitlab' },
      instances: { 'gh.acme.com': 'github' },
      hostSettings: { 'gh.acme.com': 'off' },
    });
  });

  test('tolerates one map present and the others absent', () => {
    assert.deepEqual(stateFrom({ [SETTINGS_KEY]: { github: 'gitlab' } }), {
      settings: { github: 'gitlab' },
      instances: {},
      hostSettings: {},
    });
  });

  test('collapses a legacy state whose kinds disagree, deterministically', () => {
    // The one-skin rule is a property of the data, not of the popup: a state
    // from the older per-kind model reads back with a single skin, written to
    // every kind, so every context agrees.
    assert.deepEqual(
      stateFrom({ [SETTINGS_KEY]: { github: 'gitlab', gitlab: 'github' } })
        .settings,
      {
        github: 'gitlab',
        gitlab: 'gitlab',
        bitbucket: 'gitlab',
        gerrit: 'gitlab',
      },
    );
  });

  test('leaves a state whose kinds agree alone', () => {
    assert.deepEqual(
      stateFrom({
        [SETTINGS_KEY]: { github: 'bitbucket', gitlab: 'bitbucket' },
      }).settings,
      { github: 'bitbucket', gitlab: 'bitbucket' },
    );
    assert.deepEqual(
      stateFrom({ [SETTINGS_KEY]: { github: 'gitlab' } }).settings,
      { github: 'gitlab' },
    );
  });

  test('does not mutate the stored settings while normalising', () => {
    const stored = { [SETTINGS_KEY]: { github: 'gitlab', gitlab: 'github' } };
    stateFrom(stored);
    assert.deepEqual(stored[SETTINGS_KEY], {
      github: 'gitlab',
      gitlab: 'github',
    });
  });

  test('rejects a stored value that is not a plain object', () => {
    // Synced storage is user data: a string or array must not be iterated as a
    // map, and a primitive must not be written back to.
    for (const junk of ['github', 42, true, ['github'], null]) {
      assert.deepEqual(
        stateFrom({
          [SETTINGS_KEY]: junk,
          [INSTANCES_KEY]: junk,
          [HOST_SETTINGS_KEY]: junk,
        }),
        { settings: {}, instances: {}, hostSettings: {} },
        String(junk),
      );
    }
  });
});

describe('kindOn', () => {
  test('is true when any skin is chosen for a kind', () => {
    assert.equal(kindOn('github', { github: 'gitlab' }), true);
    assert.equal(kindOn('gitlab', { gitlab: 'github' }), true);
    assert.equal(kindOn('bitbucket', { bitbucket: 'gitlab' }), true);
    assert.equal(kindOn('gerrit', { gerrit: 'gitlab' }), true);
    // A kind can now hold any theme, including one it does not default to.
    assert.equal(kindOn('github', { github: 'bitbucket' }), true);
    assert.equal(kindOn('github', { github: 'github' }), true);
  });

  test('off, junk and a missing map are off', () => {
    assert.equal(kindOn('github', { github: 'off' }), false);
    assert.equal(kindOn('github', { github: 'nonsense' }), false);
    assert.equal(kindOn('github', undefined), false);
  });

  test('an unknown kind is off, never a throw', () => {
    assert.equal(kindOn('gitbucket', { gitbucket: 'gitlab' }), false);
    assert.equal(kindOn(null, { github: 'gitlab' }), false);
  });
});

describe('hostSkinFor', () => {
  test('reads a chosen skin or off', () => {
    assert.equal(
      hostSkinFor('gh.acme.com', { 'gh.acme.com': 'gitlab' }),
      'gitlab',
    );
    assert.equal(
      hostSkinFor('gh.acme.com', { 'gh.acme.com': 'github' }),
      'github',
    );
    assert.equal(hostSkinFor('gh.acme.com', { 'gh.acme.com': 'off' }), 'off');
  });

  test('a host with no entry follows its product', () => {
    assert.equal(hostSkinFor('gh.acme.com', {}), null);
    assert.equal(hostSkinFor('gh.acme.com', null), null);
    assert.equal(hostSkinFor('gh.acme.com', undefined), null);
  });

  test('junk stored against a host is ignored, not obeyed', () => {
    // Synced storage is user data; only a known skin or `off` counts.
    for (const junk of ['on', 'yes', 'true', true, 1, null, {}]) {
      assert.equal(hostSkinFor('gh.acme.com', { 'gh.acme.com': junk }), null);
    }
  });

  test('inherited prototype keys are a miss, not a value', () => {
    assert.equal(hostSkinFor('toString', {}), null);
    assert.equal(hostSkinFor('constructor', {}), null);
    assert.equal(hostSkinFor('__proto__', {}), null);
  });
});

describe('sourceFor', () => {
  test('the public forges are their own markup', () => {
    assert.equal(sourceFor('github.com', {}), 'github');
    assert.equal(sourceFor('gitlab.com', {}), 'gitlab');
    // A self-hosted instance is its own markup once added.
    assert.equal(
      sourceFor('code.swecha.org', { 'code.swecha.org': 'gitlab' }),
      'gitlab',
    );
  });

  test('the Gitea-family forges are Gitea markup, not GitHub', () => {
    assert.equal(sourceFor('codeberg.org', {}), 'gitea');
    assert.equal(sourceFor('gitea.com', {}), 'gitea');
  });

  test('Bitbucket is its own markup', () => {
    assert.equal(sourceFor('bitbucket.org', {}), 'bitbucket');
    assert.equal(
      sourceFor('bb.acme.com', { 'bb.acme.com': 'bitbucket' }),
      'bitbucket',
    );
  });

  test('Gerrit is its own markup, and only ever user-added', () => {
    assert.equal(sourceFor('gerrit.example.com', {}), null);
    assert.equal(
      sourceFor('cr.example.com', { 'cr.example.com': 'gerrit' }),
      'gerrit',
    );
  });

  test('a user-added host is assumed to be built on its product', () => {
    assert.equal(
      sourceFor('gh.acme.com', { 'gh.acme.com': 'github' }),
      'github',
    );
    assert.equal(
      sourceFor('gl.acme.com', { 'gl.acme.com': 'gitlab' }),
      'gitlab',
    );
    assert.equal(sourceFor('unknown.example', {}), null);
  });
});

describe('themeFor', () => {
  test('a github host is on for the gitlab skin', () => {
    assert.equal(themeFor('github.com', { github: 'gitlab' }, {}), 'gitlab');
  });

  test('a gitlab host is on for the github skin', () => {
    assert.equal(themeFor('gitlab.com', { gitlab: 'github' }, {}), 'github');
  });

  test('"off" means off', () => {
    assert.equal(themeFor('github.com', { github: 'off' }, {}), null);
  });

  test('only the matching theme value switches a kind on', () => {
    // A github site is switched on by `'gitlab'`, never by `'github'`.
    assert.equal(themeFor('github.com', { github: 'github' }, {}), null);
    assert.equal(themeFor('gitlab.com', { gitlab: 'gitlab' }, {}), null);
  });

  test('a known host with no settings is off, not unknown', () => {
    assert.equal(themeFor('github.com', {}, {}), null);
    assert.equal(themeFor('github.com', undefined, {}), null);
  });

  test('an unknown host is null', () => {
    assert.equal(themeFor('example.com', { github: 'gitlab' }, {}), null);
  });

  test('user-added hosts behave like bundled ones', () => {
    const added = { 'gl.acme.com': 'gitlab' };
    assert.equal(
      themeFor('gl.acme.com', { gitlab: 'github' }, added),
      'github',
    );
  });

  test('a host can be given a skin without the product switch', () => {
    // The enterprise instance is skinned even though github.com is off.
    assert.equal(
      themeFor(
        'gh.acme.com',
        { github: 'off' },
        { 'gh.acme.com': 'github' },
        { 'gh.acme.com': 'gitlab' },
      ),
      'gitlab',
    );
  });

  test('a host can be switched off while the product is on', () => {
    assert.equal(
      themeFor(
        'gh.acme.com',
        { github: 'gitlab' },
        { 'gh.acme.com': 'github' },
        { 'gh.acme.com': 'off' },
      ),
      null,
    );
    // ...and only that host; github.com still follows the product switch.
    assert.equal(
      themeFor(
        'github.com',
        { github: 'gitlab' },
        {},
        { 'gh.acme.com': 'off' },
      ),
      'gitlab',
    );
  });

  test('a host wearing its own UI is left alone', () => {
    // Choosing GitHub's UI for a GitHub site is the same as off: it is already
    // that UI, and repainting it would run the wrong tables.
    assert.equal(
      themeFor(
        'github.com',
        { github: 'gitlab' },
        {},
        { 'github.com': 'github' },
      ),
      null,
    );
    assert.equal(
      themeFor('gitlab.com', {}, {}, { 'gitlab.com': 'gitlab' }),
      null,
    );
  });

  test('Codeberg/Gitea can wear either UI', () => {
    // Gitea is GitHub-flavoured but is not GitHub's markup, so the GitHub UI is
    // a real skin there, not a no-op.
    assert.equal(
      themeFor('codeberg.org', {}, {}, { 'codeberg.org': 'github' }),
      'github',
    );
    assert.equal(
      themeFor('codeberg.org', {}, {}, { 'codeberg.org': 'gitlab' }),
      'gitlab',
    );
    // ...and it follows its product switch (the GitHub-flavoured default is the
    // GitLab UI) when no skin is chosen.
    assert.equal(
      themeFor('codeberg.org', { github: 'gitlab' }, {}, {}),
      'gitlab',
    );
    assert.equal(themeFor('gitea.com', { github: 'gitlab' }, {}, {}), 'gitlab');
  });

  test("a host can wear the other product's skin even when its own is offered", () => {
    // The default is the cross skin; an explicit choice overrides it.
    assert.equal(
      themeFor(
        'github.com',
        { github: 'gitlab' },
        {},
        { 'github.com': 'gitlab' },
      ),
      'gitlab',
    );
  });

  test('an override on an unknown host still does nothing', () => {
    assert.equal(
      themeFor(
        'example.com',
        { github: 'gitlab' },
        {},
        { 'example.com': 'gitlab' },
      ),
      null,
    );
  });

  test('Bitbucket can wear either UI, and its own UI is a no-op', () => {
    // Bitbucket is a source as well as a target: its own markup is no source's
    // own "other" UI.
    assert.equal(
      themeFor('bitbucket.org', {}, {}, { 'bitbucket.org': 'github' }),
      'github',
    );
    assert.equal(
      themeFor('bitbucket.org', {}, {}, { 'bitbucket.org': 'gitlab' }),
      'gitlab',
    );
    // ...and painting a Bitbucket site as Bitbucket is off, like GitHub on a
    // GitHub host.
    assert.equal(
      themeFor('bitbucket.org', { bitbucket: 'bitbucket' }, {}, {}),
      null,
    );
    // A user-added Bitbucket host behaves the same.
    assert.equal(
      themeFor(
        'bb.acme.com',
        { bitbucket: 'gitlab' },
        { 'bb.acme.com': 'bitbucket' },
      ),
      'gitlab',
    );
  });

  test('Gerrit can wear either UI; it is only ever user-added', () => {
    // No host is bundled as Gerrit, so it is set up by adding one, which then
    // carries its per-host skin choice.
    assert.equal(
      themeFor(
        'cr.example.com',
        {},
        { 'cr.example.com': 'gerrit' },
        { 'cr.example.com': 'github' },
      ),
      'github',
    );
    assert.equal(
      themeFor(
        'cr.example.com',
        {},
        { 'cr.example.com': 'gerrit' },
        { 'cr.example.com': 'gitlab' },
      ),
      'gitlab',
    );
  });

  test('a host can wear the Bitbucket skin, whatever its own markup is', () => {
    // GitHub, GitLab and Gitea markup are all not Bitbucket's, so any of them
    // can be pinned to the Bitbucket UI.
    assert.equal(
      themeFor(
        'github.com',
        { github: 'gitlab' },
        {},
        { 'github.com': 'bitbucket' },
      ),
      'bitbucket',
    );
    assert.equal(
      themeFor(
        'gitlab.com',
        { gitlab: 'github' },
        {},
        { 'gitlab.com': 'bitbucket' },
      ),
      'bitbucket',
    );
    assert.equal(
      themeFor('codeberg.org', {}, {}, { 'codeberg.org': 'bitbucket' }),
      'bitbucket',
    );
  });

  test('junk in the host map falls back to the product switch', () => {
    assert.equal(
      themeFor('github.com', { github: 'gitlab' }, {}, { 'github.com': 'yes' }),
      'gitlab',
    );
    assert.equal(
      themeFor('github.com', { github: 'off' }, {}, { 'github.com': true }),
      null,
    );
  });
});

describe('globalSkin / settingsForSkin', () => {
  test('settingsForSkin selects one skin for every kind', () => {
    assert.deepEqual(settingsForSkin('gitlab'), {
      github: 'gitlab',
      gitlab: 'gitlab',
      bitbucket: 'gitlab',
      gerrit: 'gitlab',
    });
    assert.deepEqual(settingsForSkin('bitbucket'), {
      github: 'bitbucket',
      gitlab: 'bitbucket',
      bitbucket: 'bitbucket',
      gerrit: 'bitbucket',
    });
    assert.deepEqual(settingsForSkin('off'), {
      github: 'off',
      gitlab: 'off',
      bitbucket: 'off',
      gerrit: 'off',
    });
  });

  test('globalSkin round-trips settingsForSkin', () => {
    for (const theme of [...THEMES, 'off']) {
      assert.equal(globalSkin(settingsForSkin(theme)), theme);
    }
  });

  test('reads a hand-written or legacy map', () => {
    assert.equal(globalSkin({ github: 'gitlab', gitlab: 'off' }), 'gitlab');
    assert.equal(
      globalSkin({ github: 'off', gitlab: 'bitbucket' }),
      'bitbucket',
    );
    assert.equal(globalSkin({ github: 'nonsense' }), 'off');
    assert.equal(globalSkin({}), 'off');
    assert.equal(globalSkin(undefined), 'off');
  });
});

describe('hostsForSkin', () => {
  test('lists the hosts whose own markup is not already that skin', () => {
    // github.com is GitHub's own markup, so the GitHub UI leaves it alone;
    // Gitea and Bitbucket are not, so the GitHub UI repaints them.
    assert.deepEqual(hostsForSkin('github', {}).sort(), [
      'bitbucket.org',
      'codeberg.org',
      'gitea.com',
      'gitlab.com',
    ]);
    assert.deepEqual(hostsForSkin('gitlab', {}).sort(), [
      'bitbucket.org',
      'codeberg.org',
      'gitea.com',
      'github.com',
    ]);
  });

  test('the Bitbucket skin repaints every host except Bitbucket markup', () => {
    assert.deepEqual(
      hostsForSkin('bitbucket', {}).sort(),
      [...hostsFor('github', {}), ...hostsFor('gitlab', {})].sort(),
    );
    assert.ok(!hostsForSkin('bitbucket', {}).includes('bitbucket.org'));
  });

  test('off repaints nothing', () => {
    assert.deepEqual(hostsForSkin('off', {}), []);
  });
});

describe('manifest permissions', () => {
  test('the bundled host_permissions match the builtin hosts', () => {
    // The manifest cannot read sites.js, so its static host list repeats the
    // bundled hosts; this is what stops the two from drifting. Everything else
    // is requested one origin at a time from the popup.
    const manifest = JSON.parse(
      readFileSync(
        new URL('../src/manifest.base.json', import.meta.url),
        'utf8',
      ),
    );
    const expected = Object.keys(kinds)
      .flatMap((kind) => hostsFor(kind, {}))
      .map((host) => `*://${host}/*`);
    assert.deepEqual([...manifest.host_permissions].sort(), expected.sort());
    assert.ok(
      (manifest.optional_host_permissions || []).length > 0,
      'self-hosted origins are optional, not granted at install',
    );
    assert.ok(
      !manifest.host_permissions.some((p) => /^\*:\/\/\*\/\*$/.test(p)),
      'no host_permissions entry grants the whole web',
    );
  });
});
