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

  const SETTINGS_KEY = 'gitSameSettings';
  const INSTANCES_KEY = 'gitSameInstances';
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

  let settings = {};
  let instances = {};
  let host = '';
  let openedOnce = false;

  /* ---------------------------------------------------------------- state -- */

  async function load() {
    const stored = await api.storage.sync.get([SETTINGS_KEY, INSTANCES_KEY]);
    settings = stored?.[SETTINGS_KEY] ?? {};
    instances = stored?.[INSTANCES_KEY] ?? {};
  }

  async function currentHost() {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    try {
      const url = new URL(tab.url);
      // chrome://, about:, chrome-extension://, file:// — none of these are
      // hosts we could skin, and `new URL().hostname` would happily invent one.
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      return url.hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * Accepts what people actually paste. Normalisation lives in the shared lib
   * so the popup, the background and the tests all agree on it.
   * @returns {string|null} normalised hostname, or null if unusable
   */
  const parseHost = (value) => SITES.parseHost(value);

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
      const meta = SITES.kinds[kind];
      const on = settings[meta.setting] === meta.theme;

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
    const meta = SITES.kinds[kind];
    await api.storage.sync.set({
      [INSTANCES_KEY]: { ...instances, [hostname]: kind },
      // Asking to show a site implies showing it — don't make it a second click.
      [SETTINGS_KEY]: { ...settings, [meta.setting]: meta.theme },
    });
  }

  async function removeHost(hostname) {
    const next = { ...instances };
    delete next[hostname];
    await api.storage.sync.set({ [INSTANCES_KEY]: next });
  }

  async function submit(kind) {
    const hostname = parseHost(addInput.value);
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

    await addHost(hostname, kind);
    addInput.value = '';
    hint(HINT_DEFAULT, false);
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
    const hostname = parseHost(addInput.value);
    const kind = hostname ? SITES.kindFor(hostname, instances) : null;
    if (kind) submit(kind);
    else hint('Pick GitHub or GitLab.', false);
  });

  addRemove.addEventListener('click', async () => {
    const hostname = parseHost(addInput.value);
    if (!hostname) return;
    await removeHost(hostname);
    addInput.value = '';
  });

  for (const input of switches) {
    input.addEventListener('change', () => {
      const meta = SITES.kinds[input.dataset.setting];
      api.storage.sync.set({
        [SETTINGS_KEY]: {
          ...settings,
          [meta.setting]: input.checked ? meta.theme : 'off',
        },
      });
    });
  }

  // The other surfaces (shortcut, another window) can change this underneath us.
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (!changes[SETTINGS_KEY] && !changes[INSTANCES_KEY]) return;
    load().then(render);
  });

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
  })();
})();
