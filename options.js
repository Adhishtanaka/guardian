/**
 * Guardian settings page: PIN gate, then protection / allow list / activity /
 * appearance / security. Everything sits behind the PIN.
 */
import { driver } from 'driver.js';
import {
  createPinRecord, verifyPin, validatePinFormat, remainingLockout,
} from './auth.js';
import {
  getSettings, setSettings, getAllowList, setAllowList, getBlockList, setBlockList,
  getHistory, clearHistory, getPinRecord, setPinRecord,
  getLockState, setLockState, normalizeDomain, clearAllData,
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

// --- tabs -----------------------------------------------------------------
const TABS = ['protection', 'allowed', 'blocked', 'activity', 'security'];

export function showTab(name) {
  if (!TABS.includes(name)) name = TABS[0];
  for (const t of TABS) {
    document.getElementById(`panel-${t}`).hidden = t !== name;
    const btn = document.querySelector(`.tab[data-tab="${t}"]`);
    btn.setAttribute('aria-selected', String(t === name));
  }
  location.hash = name;          // survives a reload, and lets the tour deep-link
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (btn) showTab(btn.dataset.tab);
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
  showTab(location.hash.replace('#', '') || 'protection');
  await render();
  const { tourDone } = await getSettings();
  if (!tourDone) { await setSettings({ tourDone: true }); setTimeout(runTour, 400); }
}

// --- rendering ------------------------------------------------------------
async function render() {
  const s = await getSettings();
  $('autoScan').checked = s.autoScan;
  $('blockFlagged').checked = s.blockFlagged;
  $('safetyNet').checked = s.safetyNet;
  $('confirmScan').checked = s.confirmScan;
  $('videoRescanSeconds').value = String(s.videoRescanSeconds);
  await renderSiteList('allow');
  await renderSiteList('block');
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

async function renderSiteList(kind) {
  const isAllow = kind === 'allow';
  const get = isAllow ? getAllowList : getBlockList;
  const set = isAllow ? setAllowList : setBlockList;
  const list = await get();
  const ul = $(isAllow ? 'allowList' : 'blockList');
  ul.replaceChildren();

  const badge = document.querySelector(`.tab[data-tab="${isAllow ? 'allowed' : 'blocked'}"] .count`);
  if (badge) badge.textContent = list.length || '';

  if (!list.length) {
    ul.append(el('li', 'empty', isAllow ? 'No sites allowed yet.' : 'No sites blocked yet.'));
    return;
  }
  list.forEach((entry, i) => {
    const li = el('li');
    const box = el('div', 'grow');
    box.append(el('div', 'mono', entry.domain));
    box.append(el('div', 'sub', entry.includeSubdomains
      ? `including subdomains` : 'this domain only'));
    const toggle = el('button', 'ghost',
      entry.includeSubdomains ? 'Subdomains: on' : 'Subdomains: off');
    toggle.onclick = async () => {
      const l = await get();
      l[i].includeSubdomains = !l[i].includeSubdomains;
      await set(l);
      renderSiteList(kind);
    };
    const del = el('button', 'danger', 'Remove');
    del.onclick = async () => {
      const l = await get();
      l.splice(i, 1);
      await set(l);
      renderSiteList(kind);
    };
    li.append(box, toggle, del);
    ul.append(li);
  });
}

async function addSite(kind) {
  const isAllow = kind === 'allow';
  const msg = $(isAllow ? 'allowError' : 'blockError');
  const input = $(isAllow ? 'allowInput' : 'blockInput');
  const subs = $(isAllow ? 'allowSubs' : 'blockSubs');
  const get = isAllow ? getAllowList : getBlockList;
  const set = isAllow ? setAllowList : setBlockList;

  msg.textContent = '';
  const domain = normalizeDomain(input.value);
  if (!domain) return void (msg.textContent = 'Enter a site like example.com');
  const list = await get();
  if (list.some((e) => e.domain === domain)) {
    return void (msg.textContent = 'That site is already on this list.');
  }
  list.push({ domain, includeSubdomains: subs.checked });
  await set(list);
  input.value = '';
  renderSiteList(kind);
}

async function renderHistory() {
  const hist = await getHistory();
  const ul = $('historyList');
  ul.replaceChildren();
  const badge = document.querySelector('.tab[data-tab="activity"] .count');
  if (badge) badge.textContent = hist.length || '';
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
      renderSiteList('allow');
      allow.textContent = 'Allowed';
      allow.disabled = true;
    };
    li.append(box, allow);
    ul.append(li);
  }
}

// --- guided tour ----------------------------------------------------------
function runTour() {
  // Each step switches to its tab first, otherwise driver.js would try to highlight
  // a panel that is still hidden.
  const step = (tab, element, title, description) => ({
    element,
    onHighlightStarted: () => showTab(tab),
    popover: { title, description },
  });
  driver({
    showProgress: true,
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    steps: [
      step('protection', '#panel-protection', 'Protection',
           'Guardian checks every page as it loads, here on this computer. '
           + 'You can pause scanning or stop it covering blocked pages.'),
      step('allowed', '#panel-allowed', 'Allowed sites',
           'If a safe site is ever blocked by mistake, add it here and Guardian '
           + 'will skip it from then on.'),
      step('blocked', '#panel-blocked', 'Blocked sites',
           'Sites you always want blocked, whatever the model decides. '
           + 'If a site is on both lists, it stays blocked.'),
      step('activity', '#panel-activity', 'Activity',
           'Pages that were blocked appear here. Ordinary browsing is never recorded. '
           + 'You can allow a site straight from this list.'),
      step('security', '#panel-security', 'PIN and reset',
           'Your PIN protects these settings and is required to reveal a blocked page. '
           + 'Clearing all data returns Guardian to its first-run state.'),
    ],
    onDestroyed: () => showTab('protection'),
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
$('safetyNet').addEventListener('change', (e) => setSettings({ safetyNet: e.target.checked }));
$('confirmScan').addEventListener('change', (e) => setSettings({ confirmScan: e.target.checked }));
$('videoRescanSeconds').addEventListener('change',
  (e) => setSettings({ videoRescanSeconds: Number(e.target.value) }));

$('allowAdd').addEventListener('click', () => addSite('allow'));
$('blockAdd').addEventListener('click', () => addSite('block'));
$('allowInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addSite('allow'); });
$('blockInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addSite('block'); });

// --- reset -----------------------------------------------------------------
$('clearAll').addEventListener('click', async () => {
  const msg = $('resetMsg');
  msg.textContent = '';
  const record = await getPinRecord();
  if (!await verifyPin($('resetPin').value, record)) {
    return void (msg.textContent = 'Incorrect PIN — nothing was erased.');
  }
  if (!confirm('Erase the PIN, both site lists, all history and every setting?\n\n'
             + 'Guardian returns to its first-run state. This cannot be undone.')) return;
  await clearAllData();
  location.reload();
});

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
  await initLock();
})();
