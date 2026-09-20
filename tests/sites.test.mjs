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
  themeFor,
  stateFrom,
  kinds,
  THEMES,
  SETTINGS_KEY,
  INSTANCES_KEY,
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
      themeFor,
      stateFrom,
    ]) {
      assert.equal(typeof fn, 'function');
    }
  });

  test('the storage schema and theme list are the shared ones', () => {
    assert.deepEqual(STORAGE_KEYS, [SETTINGS_KEY, INSTANCES_KEY]);
    assert.equal(SETTINGS_KEY, 'gitSameSettings');
    assert.equal(INSTANCES_KEY, 'gitSameInstances');
    // Derived from `kinds`, so a third kind contributes its theme exactly once.
    assert.deepEqual(THEMES, ['gitlab', 'github']);
  });

  test('a kind is always skinned with the *other* product', () => {
    assert.equal(kinds.github.theme, 'gitlab');
    assert.equal(kinds.gitlab.theme, 'github');
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
    assert.equal(kindFor('code.swecha.org', {}), 'gitlab');
  });

  test('falls back to the user-added map', () => {
    const added = { 'github.acme.com': 'github', 'gl.acme.com': 'gitlab' };
    assert.equal(kindFor('github.acme.com', added), 'github');
    assert.equal(kindFor('gl.acme.com', added), 'gitlab');
  });

  test('returns null for hosts it has never seen', () => {
    assert.equal(kindFor('example.com', {}), null);
    assert.equal(kindFor('github.acme.com', {}), null);
    assert.equal(kindFor('github.com', null), 'github'); // builtin needs no map
  });

  test('ignores junk stored against a host', () => {
    assert.equal(kindFor('evil.example', { 'evil.example': 'bitbucket' }), null);
    assert.equal(kindFor('evil.example', { 'evil.example': null }), null);
  });

  test('the bundled table wins over anything the user stored', () => {
    assert.equal(kindFor('github.com', { 'github.com': 'gitlab' }), 'github');
    assert.equal(kindFor('gitlab.com', { 'gitlab.com': 'github' }), 'gitlab');
  });
});

describe('hostsFor', () => {
  test('lists the bundled hosts, user hosts after', () => {
    assert.deepEqual(hostsFor('github', {}), ['github.com']);
    assert.deepEqual(hostsFor('gitlab', {}), ['gitlab.com', 'code.swecha.org']);
    assert.deepEqual(hostsFor('gitlab', { 'gl.acme.com': 'gitlab' }), [
      'gitlab.com',
      'code.swecha.org',
      'gl.acme.com',
    ]);
  });

  test('never duplicates a host and never mixes kinds', () => {
    assert.deepEqual(hostsFor('github', { 'github.com': 'github' }), [
      'github.com',
    ]);
    assert.deepEqual(
      hostsFor('github', { 'gl.acme.com': 'gitlab', 'gh.acme.com': 'github' }),
      ['github.com', 'gh.acme.com'],
    );
  });

  test('tolerates a missing added map and junk values', () => {
    assert.deepEqual(hostsFor('github', null), ['github.com']);
    assert.deepEqual(hostsFor('github', { 'x.example': 'nonsense' }), [
      'github.com',
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
      ['github.com', 'ok.example'],
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
    assert.equal(isBuiltin('code.swecha.org'), true);
    assert.equal(isBuiltin('github.acme.com'), false);
    // Guard against prototype-key false positives.
    assert.equal(isBuiltin('constructor'), false);
  });

  test('accepts exactly the two kinds', () => {
    assert.equal(isKind('github'), true);
    assert.equal(isKind('gitlab'), true);
    assert.equal(isKind('bitbucket'), false);
    assert.equal(isKind(''), false);
    assert.equal(isKind(null), false);
  });
});

describe('stateFrom', () => {
  test('applies the defaults for a first run', () => {
    assert.deepEqual(stateFrom(undefined), { settings: {}, instances: {} });
    assert.deepEqual(stateFrom({}), { settings: {}, instances: {} });
  });

  test('reads the two maps under their shared keys', () => {
    const stored = {
      [SETTINGS_KEY]: { github: 'gitlab' },
      [INSTANCES_KEY]: { 'gh.acme.com': 'github' },
    };
    assert.deepEqual(stateFrom(stored), {
      settings: { github: 'gitlab' },
      instances: { 'gh.acme.com': 'github' },
    });
  });

  test('tolerates one map present and the other absent', () => {
    assert.deepEqual(stateFrom({ [SETTINGS_KEY]: { github: 'gitlab' } }), {
      settings: { github: 'gitlab' },
      instances: {},
    });
  });
});

describe('kindOn', () => {
  test('is the single definition of "on" for a kind', () => {
    assert.equal(kindOn('github', { github: 'gitlab' }), true);
    assert.equal(kindOn('gitlab', { gitlab: 'github' }), true);
  });

  test('off, the wrong theme and a missing map are all off', () => {
    assert.equal(kindOn('github', { github: 'off' }), false);
    assert.equal(kindOn('github', { github: 'github' }), false);
    assert.equal(kindOn('github', undefined), false);
  });

  test('an unknown kind is off, never a throw', () => {
    assert.equal(kindOn('bitbucket', { bitbucket: 'gitlab' }), false);
    assert.equal(kindOn(null, { github: 'gitlab' }), false);
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
    assert.equal(themeFor('gl.acme.com', { gitlab: 'github' }, added), 'github');
  });
});
