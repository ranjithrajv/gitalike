/**
 * gitalike — toolbar popup.
 *
 * The extension matches the entire web, so there is no permission to request
 * and nothing to pre-configure: the popup classifies hosts and switches each
 * product on or off. It can classify the tab you are on, or a host you type in
 * — GitHub Enterprise addresses are not something you always want to visit
 * first.
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

  const rows = [...document.querySelectorAll('.row')];
  const switches = [...document.querySelectorAll('.switch')];
  const addToggle = document.getElementById('add-toggle');
  const addSummary = document.getElementById('add-summary');
  const addBody = document.getElementById('add-body');
  const addInput = document.getElementById('add-input');
  const addHint = document.getElementById('add-hint');
  const addRemove = document.getElementById('add-remove');
  const kindButtons = [...document.querySelectorAll('.add__button[data-kind]')];
  const openOther = document.getElementById('open-other');

  let settings = {};
  let instances = {};
  let host = '';
  let pageUrl = '';
  let pageProtocol = '';
  let openedOnce = false;

  const HINT_INSECURE = (name) =>
    `${name} is on http:// — the connection is not encrypted.`;

  /* ---------------------------------------------------------------- state -- */

  async function load() {
    const stored = await api.storage.sync.get(SITES.STORAGE_KEYS);
    ({ settings, instances } = SITES.stateFrom(stored));
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

    for (const row of rows) {
      const kind = row.dataset.setting;
      const on = SITES.kindOn(kind, settings);

      row.querySelector('.switch').checked = on;
      row.classList.toggle('row--on', on);
      // A product can cover several hosts once instances are added.
      row.querySelector('[data-role="hosts"]').textContent = SITES.hostsFor(
        kind,
        instances,
      ).join(', ');
      row.classList.toggle('row--current', kind === currentKind);
    }

    renderAdd(currentKind);
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
    await api.storage.sync.set({
      [SITES.INSTANCES_KEY]: { ...instances, [hostname]: kind },
      // Asking to show a site implies showing it — don't make it a second click.
      [SITES.SETTINGS_KEY]: { ...settings, [kind]: SITES.kinds[kind].theme },
    });
  }

  async function removeHost(hostname) {
    const next = { ...instances };
    delete next[hostname];
    await api.storage.sync.set({ [SITES.INSTANCES_KEY]: next });
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
    await addHost(hostname, kind);
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

  for (const input of switches) {
    input.addEventListener('change', () => {
      const kind = input.dataset.setting;
      api.storage.sync.set({
        [SITES.SETTINGS_KEY]: {
          ...settings,
          [kind]: input.checked ? SITES.kinds[kind].theme : 'off',
        },
      });
    });
  }

  // The other surfaces (shortcut, another window) can change this underneath us.
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes[SITES.SETTINGS_KEY] && !changes[SITES.INSTANCES_KEY]) return;
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
    render();
    await showShortcut();
    renderOther();
  })();
})();
