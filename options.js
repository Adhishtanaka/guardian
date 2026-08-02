/**
 * Guardian settings page: PIN gate, then protection / allow list / activity /
 * appearance / security. Everything sits behind the PIN.
 */
import { driver } from 'driver.js';
import {
  createPinRecord, verifyPin, validatePinFormat, remainingLockout,
} from './auth.js';
import {
  DEFAULTS, getSettings, setSettings, getAllowList, setAllowList,
  getHistory, clearHistory, getPinRecord, setPinRecord,
  getLockState, setLockState, normalizeDomain,
} from './store.js';

const $ = (id) => document.getElementById(id);
// Built as DOM nodes, never innerHTML: history rows contain hostnames and paths
// that came from whatever page the child visited.
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// --- theme ----------------------------------------------------------------
const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(pref) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
media.addEventListener('change', async () => {
  const { theme } = await getSettings();
  if (theme === 'system') applyTheme('system');
});

// --- PIN gate -------------------------------------------------------------
let isFirstRun = false;

async function initLock() {
  const record = await getPinRecord();
  isFirstRun = !record;
  if (isFirstRun) {
    $('lockTitle').textContent = 'Create a PIN';
    $('lockSub').textContent =
      'Choose 4–8 digits. You will need it to change Guardian’s settings.';
    $('pin2').hidden = false;
    $('lockBtn').textContent = 'Create PIN';
    $('forgot').hidden = true;
  }
  $('pin1').focus();
}

async function attemptUnlock() {
  const err = $('lockError');
  err.textContent = '';
  const pin = $('pin1').value;

  if (isFirstRun) {
    const bad = validatePinFormat(pin);
    if (bad) return void (err.textContent = bad);
    if (pin !== $('pin2').value) return void (err.textContent = 'The two PINs do not match.');
    await setPinRecord(await createPinRecord(pin));
    return unlock();
  }

  const lock = await getLockState();
  const waitMs = remainingLockout(lock);
  if (waitMs > 0) {
    return void (err.textContent =
      `Too many attempts. Try again in ${Math.ceil(waitMs / 1000)}s.`);
  }

  if (await verifyPin(pin, await getPinRecord())) {
    await setLockState({ failedAttempts: 0, lastFailedAt: 0 });
    return unlock();
  }

  const failedAttempts = (lock.failedAttempts || 0) + 1;
  await setLockState({ failedAttempts, lastFailedAt: Date.now() });
  $('pin1').value = '';
  const next = remainingLockout({ failedAttempts, lastFailedAt: Date.now() });
  err.textContent = next > 0
    ? `Incorrect PIN. Locked for ${Math.ceil(next / 1000)}s.`
    : 'Incorrect PIN.';
}

async function unlock() {
  $('lock').hidden = true;
  $('app').hidden = false;
  await render();
  const { tourDone } = await getSettings();
  if (!tourDone) { await setSettings({ tourDone: true }); setTimeout(runTour, 400); }
}

// --- rendering ------------------------------------------------------------
async function render() {
  const s = await getSettings();
  $('autoScan').checked = s.autoScan;
  $('blockFlagged').checked = s.blockFlagged;
  $('theme').value = s.theme;
  applyTheme(s.theme);
  await renderAllow();
  await renderHistory();
  renderModelInfo();
}

async function renderModelInfo() {
  try {
    const cfg = await (await fetch(chrome.runtime.getURL('model/vocab.json'))).json();
    $('modelInfo').textContent =
      `${cfg.backbone} · ${cfg.class_names.join(' / ')} · runs on this device`;
  } catch {
    $('modelInfo').textContent = 'model files missing from model/';
  }
}

async function renderAllow() {
  const list = await getAllowList();
  const ul = $('allowList');
  ul.replaceChildren();
  if (!list.length) {
    ul.append(el('li', 'empty', 'No sites allowed yet.'));
    return;
  }
  list.forEach((entry, i) => {
    const li = el('li');
    const box = el('div', 'grow');
    box.append(el('div', 'mono', entry.domain));
    box.append(el('div', 'sub', entry.includeSubdomains
      ? 'including subdomains' : 'this domain only'));
    const toggle = el('button', 'ghost',
      entry.includeSubdomains ? 'Subdomains: on' : 'Subdomains: off');
    toggle.onclick = async () => {
      const l = await getAllowList();
      l[i].includeSubdomains = !l[i].includeSubdomains;
      await setAllowList(l);
      renderAllow();
    };
    const del = el('button', 'danger', 'Remove');
    del.onclick = async () => {
      const l = await getAllowList();
      l.splice(i, 1);
      await setAllowList(l);
      renderAllow();
    };
    li.append(box, toggle, del);
    ul.append(li);
  });
}

async function renderHistory() {
  const hist = await getHistory();
  const ul = $('historyList');
  ul.replaceChildren();
  if (!hist.length) {
    ul.append(el('li', 'empty', 'Nothing has been blocked yet.'));
    return;
  }
  for (const h of hist.slice(0, 100)) {
    const li = el('li');
    li.append(el('span', `pill ${h.label}`, h.label));
    const box = el('div', 'grow');
    box.append(el('div', 'mono', h.host + (h.path || '')));
    box.append(el('div', 'sub',
      `${new Date(h.ts).toLocaleString()} · ${Math.round(h.confidence * 100)}% confident`));
    const allow = el('button', 'ghost', 'Allow site');
    allow.onclick = async () => {
      const d = normalizeDomain(h.host);
      if (!d) return;
      const l = await getAllowList();
      if (!l.some((e) => e.domain === d)) l.push({ domain: d, includeSubdomains: true });
      await setAllowList(l);
      renderAllow();
      allow.textContent = 'Allowed';
      allow.disabled = true;
    };
    li.append(box, allow);
    ul.append(li);
  }
}

// --- guided tour ----------------------------------------------------------
function runTour() {
  driver({
    showProgress: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    steps: [
      { element: '#secProtection', popover: {
        title: 'Protection',
        description: 'Guardian checks every page as it loads, on this computer. ' +
                     'Turn scanning off here if you ever need to.' } },
      { element: '#secAllow', popover: {
        title: 'Allowed sites',
        description: 'If a safe site is blocked by mistake, add it here and Guardian ' +
                     'will skip it from then on.' } },
      { element: '#secActivity', popover: {
        title: 'Activity',
        description: 'Pages that were blocked show up here. Ordinary browsing is never ' +
                     'recorded. You can allow a site straight from this list.' } },
      { element: '#secSecurity', popover: {
        title: 'Your PIN',
        description: 'Change your PIN here. Read the note underneath — it explains what ' +
                     'the PIN can and cannot protect against.' } },
    ],
  }).drive();
}

// --- wiring ---------------------------------------------------------------
$('lockBtn').addEventListener('click', attemptUnlock);
[$('pin1'), $('pin2')].forEach((i) =>
  i.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); }));

$('forgot').addEventListener('click', () => {
  $('lockError').textContent =
    'There is no recovery. Remove Guardian at chrome://extensions and add it again — ' +
    'that clears the PIN, the allowed sites and the history.';
});

$('autoScan').addEventListener('change', (e) => setSettings({ autoScan: e.target.checked }));
$('blockFlagged').addEventListener('change', (e) => setSettings({ blockFlagged: e.target.checked }));
$('theme').addEventListener('change', (e) => {
  setSettings({ theme: e.target.value });
  applyTheme(e.target.value);
});

$('allowAdd').addEventListener('click', async () => {
  const msg = $('allowError');
  msg.textContent = '';
  const domain = normalizeDomain($('allowInput').value);
  if (!domain) return void (msg.textContent = 'Enter a site like example.com');
  const list = await getAllowList();
  if (list.some((e) => e.domain === domain)) {
    return void (msg.textContent = 'That site is already allowed.');
  }
  list.push({ domain, includeSubdomains: $('allowSubs').checked });
  await setAllowList(list);
  $('allowInput').value = '';
  renderAllow();
});
$('allowInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('allowAdd').click(); });

$('clearHistory').addEventListener('click', async () => {
  await clearHistory();
  renderHistory();
});

$('changePin').addEventListener('click', async () => {
  const msg = $('pinMsg');
  const pin = $('newPin').value;
  const bad = validatePinFormat(pin);
  if (bad) return void (msg.textContent = bad);
  await setPinRecord(await createPinRecord(pin));
  $('newPin').value = '';
  msg.textContent = 'PIN updated.';
});

$('startTour').addEventListener('click', runTour);
$('lockNow').addEventListener('click', () => location.reload());

(async () => {
  applyTheme((await getSettings()).theme || DEFAULTS.theme);
  await initLock();
})();
