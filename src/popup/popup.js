/**
 * gitalike — toolbar popup.
 *
 * The bundled hosts are granted at install; a self-hosted instance is added by
 * typing it here, which asks for that one origin (a click is a user gesture) and
 * stores it. The popup classifies hosts and switches each product on or off, and
 * can classify the tab you are on or a host you type in — GitHub Enterprise
 * addresses are not something you always want to visit first.
 */
(() => {
  'use strict';

  const api = globalThis.browser ?? globalThis.chrome;
  if (!api?.storage?.sync) return;

  const SITES = globalThis.GITALIKE;
  if (!SITES) return;

  const UX = globalThis.GITALIKE_UX;
  if (!UX) return;

  const HINT_DEFAULT = 'Which product is it?';
  // Where a "report a missed spot" issue is filed. Kept here, beside the popup
  // that links to it, rather than in the shared tables.
  const ISSUES_URL = 'https://github.com/ranjithrajv/gitalike/issues/new';

  const skinOptions = document.getElementById('skin-options');
  const siteWrap = document.getElementById('site');
  const siteHost = document.getElementById('site-host');
  const siteOptions = document.getElementById('site-options');
  const siteReset = document.getElementById('site-reset');
  const addToggle = document.getElementById('add-toggle');
  const addSummary = document.getElementById('add-summary');
  const addBody = document.getElementById('add-body');
  const addInput = document.getElementById('add-input');
  const addHint = document.getElementById('add-hint');
  const addRemove = document.getElementById('add-remove');
  const kindButtons = [...document.querySelectorAll('.add__button[data-kind]')];
  const openOther = document.getElementById('open-other');
  const report = document.getElementById('report');

  let settings = {};
  let instances = {};
  let hostSettings = {};
  let host = '';
  let pageUrl = '';
  let pageProtocol = '';
  let openedOnce = false;

  const HINT_INSECURE = (name) =>
    `${name} is on http:// — the connection is not encrypted.`;

  // `permissions.request` is a promise in Firefox and a callback in Chromium;
  // accept either. It must be reached while the click is still the active user
  // gesture, so `addHost` calls it before any other await.
  function permissionsRequest(details) {
    if (!api.permissions?.request) return Promise.resolve(true);
    return new Promise((resolve) => {
      let settled = false;
      const done = (granted) => {
        if (settled) return;
        settled = true;
        resolve(Boolean(granted));
      };
      try {
        const maybe = api.permissions.request(details, done);
        if (maybe && typeof maybe.then === 'function') {
          maybe.then(done, () => done(false));
        }
      } catch {
        done(false);
      }
    });
  }

  /* ---------------------------------------------------------------- state -- */

  async function load() {
    const stored = await api.storage.sync.get(SITES.STORAGE_KEYS);
    ({ settings, instances, hostSettings } = SITES.stateFrom(stored));
  }

  async function currentHost() {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    pageUrl = tab?.url ?? '';
    try {
      const url = new URL(pageUrl);
      pageProtocol = url.protocol;
      // chrome://, about:, chrome-extension://, file:// — none of these are
      // hosts we could skin, and `new URL().hostname` would happily invent one.
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.hostname.toLowerCase();
    } catch {
      pageProtocol = '';
      return '';
    }
  }

  /* --------------------------------------------------------------- render -- */

  function setOpen(open) {
    addBody.hidden = !open;
    addToggle.setAttribute('aria-expanded', String(open));
  }

  function hint(message, isError) {
    addHint.textContent = message || HINT_DEFAULT;
    addHint.classList.toggle('add__hint--error', Boolean(isError));
  }

  function render() {
    const currentKind = SITES.kindFor(host, instances);
    renderSkin();
    renderAdd(currentKind);
    renderSite(currentKind);
  }

  // One radio per skin, plus off, built from the shared `skins` table. Both the
  // global group and the per-site group use this; only the classes, the radio
  // name and the off position differ.
  function buildRadios(
    container,
    name,
    { offFirst = false, withHosts = false } = {},
  ) {
    const choices = SITES.THEMES.map((theme) => ({
      value: theme,
      label: `${SITES.skins[theme].product} UI`,
    }));
    const off = { value: 'off', label: 'Off' };
    if (offFirst) choices.unshift(off);
    else choices.push(off);

    for (const { value, label } of choices) {
      const option = document.createElement('label');
      option.className = withHosts ? 'skin__option' : 'site__option';
      if (withHosts) option.dataset.skin = value;
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = name;
      input.value = value;
      const text = document.createElement('span');
      if (withHosts) {
        text.className = 'skin__text';
        const labelEl = document.createElement('span');
        labelEl.className = 'skin__label';
        labelEl.textContent = label;
        const hostsEl = document.createElement('span');
        hostsEl.className = 'skin__hosts';
        text.append(labelEl, hostsEl);
      } else {
        text.textContent = label;
      }
      option.append(input, text);
      container.append(option);
    }
  }

  function buildSkinOptions() {
    buildRadios(skinOptions, 'gs-skin', { withHosts: true });
  }

  function renderSkin() {
    const current = SITES.globalSkin(settings);
    for (const option of skinOptions.querySelectorAll('.skin__option')) {
      const value = option.dataset.skin;
      option.querySelector('input').checked = value === current;
      const hosts = SITES.hostsForSkin(value, instances);
      option.querySelector('.skin__hosts').textContent = hosts.length
        ? hosts.join(', ')
        : 'Nothing is repainted';
      option.classList.toggle(
        'skin__option--current',
        Boolean(host) && hosts.includes(host),
      );
    }
  }

  // The per-site skin picker, shown only for a host the extension knows. The
  // global skin above is the broad default; this picks *this* host's skin, or
  // `off`, or back to following the global choice.
  function renderSite(currentKind) {
    const known = Boolean(currentKind);
    siteWrap.hidden = !known;
    if (!known) return;

    const chosen = SITES.hostSkinFor(host, hostSettings);
    const fallback = SITES.kindOn(currentKind, settings)
      ? settings[currentKind]
      : null;
    // What the group should show selected: the explicit choice, else the
    // product's default, else off. (A site's own skin and `off` both leave it
    // unrepainted, but the choice is still what the user asked for.)
    const selected = chosen === 'off' ? 'off' : chosen || fallback || 'off';

    siteHost.textContent = host;
    for (const input of siteOptions.querySelectorAll('input')) {
      input.checked = input.value === selected;
    }
    siteReset.hidden = chosen === null;
  }

  // Built once from the shared `skins` table: Off, then one radio per skin.
  function buildSiteOptions() {
    buildRadios(siteOptions, 'gs-site-skin', { offFirst: true });
  }

  function renderAdd(currentKind) {
    const known = Boolean(currentKind);
    const added = known && !SITES.isBuiltin(host);

    if (host && !known) addSummary.textContent = `${host} is not set up`;
    else if (added) addSummary.textContent = `${host} was added by you`;
    else addSummary.textContent = 'Add a site';

    // Prefill with the host in front of the user, when it is one they could act
    // on. Never overwrite something they have typed.
    if (host && !known && addInput.value === '') addInput.value = host;
    if (added && addInput.value === '') addInput.value = host;

    // Flag a site served over plain http: the skin still applies, but the page
    // could have been altered in transit.
    if (pageProtocol === 'http:' && host && !known) {
      hint(HINT_INSECURE(host), false);
    }

    // Open automatically the first time there is a decision waiting, then
    // respect whatever the user does with the toggle.
    if (!openedOnce && (host === '' || !known || added)) {
      setOpen(true);
      openedOnce = true;
    }

    addRemove.hidden = !added;
    for (const button of kindButtons) {
      button.classList.toggle('add__button--current', button.dataset.kind === currentKind);
    }
  }

  /* -------------------------------------------------------------- actions -- */

  async function addHost(hostname, kind) {
    // Access to the one origin is asked for here, from the Add a site click (a
    // user gesture). Bundled hosts are already granted; a self-hosted instance
    // prompts once. Declining adds nothing.
    if (api.permissions?.request) {
      const granted = await permissionsRequest({ origins: [`*://${hostname}/*`] });
      if (!granted) return false;
    }
    // Asking to show a site implies showing it — don't make it a second click.
    // With one skin active at a time, that also turns the others off.
    await api.storage.sync.set({
      [SITES.INSTANCES_KEY]: { ...instances, [hostname]: kind },
      [SITES.SETTINGS_KEY]: SITES.settingsForSkin(SITES.kinds[kind].theme),
    });
    return true;
  }

  async function removeHost(hostname) {
    const next = { ...instances };
    delete next[hostname];
    // Drop any per-host pin too, so a removed site leaves nothing behind.
    const nextHostSettings = { ...hostSettings };
    delete nextHostSettings[hostname];
    await api.storage.sync.set({
      [SITES.INSTANCES_KEY]: next,
      [SITES.HOST_SETTINGS_KEY]: nextHostSettings,
    });
  }

  async function submit(kind) {
    const hostname = SITES.parseHost(addInput.value);
    if (!hostname) {
      hint('That does not look like a web address.', true);
      addInput.focus();
      return;
    }
    if (SITES.isBuiltin(hostname)) {
      hint(`${hostname} is built in already.`, true);
      addInput.focus();
      return;
    }

    // Read the input before clearing it: an explicit http:// URL, or the plain
    // http page we are on, both mean the same warning.
    const insecure =
      /^http:\/\//i.test(addInput.value.trim()) ||
      (hostname === host && pageProtocol === 'http:');
    const added = await addHost(hostname, kind);
    if (!added) {
      hint(`${hostname} was not granted access, so it was not added.`, true);
      addInput.focus();
      return;
    }
    addInput.value = '';
    hint(insecure ? HINT_INSECURE(hostname) : HINT_DEFAULT, false);
  }

  addToggle.addEventListener('click', () => setOpen(addBody.hidden));

  for (const button of kindButtons) {
    button.addEventListener('click', () => submit(button.dataset.kind));
  }

  addInput.addEventListener('input', () => {
    if (addHint.classList.contains('add__hint--error')) hint(HINT_DEFAULT, false);
  });

  addInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    // One field, two possible answers — so Enter takes the host's real product.
    const hostname = SITES.parseHost(addInput.value);
    const kind = hostname ? SITES.kindFor(hostname, instances) : null;
    if (kind) submit(kind);
    else hint('Pick GitHub or GitLab.', false);
  });

  addRemove.addEventListener('click', async () => {
    const hostname = SITES.parseHost(addInput.value);
    if (!hostname) return;
    await removeHost(hostname);
    addInput.value = '';
  });

  // Picking a skin turns the other off, so only one is ever active.
  skinOptions.addEventListener('change', (event) => {
    const value = event.target?.value;
    if (!value) return;
    api.storage.sync.set({
      [SITES.SETTINGS_KEY]: SITES.settingsForSkin(value),
    });
  });

  // Pick this host's skin, independent of the global skin.
  siteOptions.addEventListener('change', (event) => {
    const value = event.target?.value;
    if (!value) return;
    api.storage.sync.set({
      [SITES.HOST_SETTINGS_KEY]: { ...hostSettings, [host]: value },
    });
  });

  // Drop the choice so the host follows the global skin again.
  siteReset.addEventListener('click', () => {
    const next = { ...hostSettings };
    delete next[host];
    api.storage.sync.set({ [SITES.HOST_SETTINGS_KEY]: next });
  });

  // The other surfaces (shortcut, another window) can change this underneath us.
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (
      !changes[SITES.SETTINGS_KEY] &&
      !changes[SITES.INSTANCES_KEY] &&
      !changes[SITES.HOST_SETTINGS_KEY]
    ) {
      return;
    }
    load().then(render);
  });

  function renderOther() {
    const other = UX.otherHostUrl(pageUrl);
    if (!other) {
      openOther.hidden = true;
      return;
    }
    // Which product the target host is lives with the host-pair table, not here.
    const target = UX.hostProduct(other);
    openOther.textContent = `Open this page on ${target}`;
    openOther.hidden = false;
    openOther.onclick = () => api.tabs.create({ url: other });
  }

  // A prefilled issue, carrying what the popup already knows and the fields
  // CONTRIBUTING.md asks a reporter for. It deliberately does not attach the
  // page: gitalike reads nothing from a page and sends nothing anywhere, and a
  // report should not be the one exception.
  function renderReport() {
    report.onclick = () => {
      const theme = SITES.themeFor(host, settings, instances, hostSettings);
      const showing = theme
        ? `the ${SITES.skins[theme].product} UI`
        : 'no skin (the site is not set up, or is switched off)';
      const title = host ? `Skin miss on ${host}` : 'Skin miss';
      const body = [
        `**Host:** ${host || '(not a website)'}`,
        `**Showing:** ${showing}`,
        '**Signed in:** <!-- yes/no -->',
        '**Theme:** <!-- light/dark -->',
        '',
        '**What I expected versus what I saw:**',
        '<!-- ... -->',
        '',
        '**Element and property (for a skin miss):**',
        "<!-- e.g. `.Box` has `background: #fff`, GitLab's would be #fbfafd -->",
        '',
        `_Reported with gitalike ${api.runtime.getManifest().version}._`,
      ].join('\n');
      api.tabs.create({
        url: `${ISSUES_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,
      });
    };
  }

  async function showShortcut() {
    const el = document.getElementById('shortcut');
    try {
      const commands = await api.commands.getAll();
      const command = commands.find((entry) => entry.name === 'toggle-site');
      if (command?.shortcut) {
        el.textContent = command.shortcut.replace(/\+/g, ' + ');
        return;
      }
    } catch {
      /* commands API unavailable */
    }
    el.textContent = 'unbound';
    el.classList.add('kbd--unset');
  }

  (async () => {
    host = await currentHost();
    await load();
    // `stateFrom` already collapses a pre-one-skin state (both kinds on) to a
    // single skin, so the popup just renders what every other context sees.
    buildSkinOptions();
    buildSiteOptions();
    render();
    await showShortcut();
    renderOther();
    renderReport();
  })();
})();
