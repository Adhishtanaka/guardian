/**
 * Service worker: watches navigation, scans each page automatically, and warns.
 *
 * The heavy work (Tesseract + LiteRT) runs in an offscreen document because a MV3
 * service worker has no DOM and gets torn down aggressively — an offscreen page can
 * hold the compiled model in memory across navigations instead of recompiling it
 * every time.
 */

import { getSettings, getAllowList, isAllowed, recordFlagged } from './store.js';

const OFFSCREEN = 'offscreen.html';
const RECENT = new Map();          // tabId -> { url, verdict }
const COOLDOWN_MS = 4000;
let lastScanAt = 0;
let scanning = false;

const BADGE = {
  normal: { text: 'OK', color: '#16a34a' },
  allowed: { text: '\u2713', color: '#64748b' },
  nsfw: { text: '18+', color: '#e03131' },
  malicious: { text: '!', color: '#f08c00' },
  error: { text: '?', color: '#868e96' },
};

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN,
    reasons: ['WORKERS'],          // Tesseract spawns web workers
    justification: 'Runs the on-device OCR and CNN classifier.',
  });
}

// --- toolbar icon animation ------------------------------------------------
// Chrome has no animated-icon API, so we swap frames on a timer while a scan runs.
const SCAN_FRAMES = 10;
const IDLE_ICON = {
  16: 'icons/icon16.png', 32: 'icons/icon32.png',
  48: 'icons/icon48.png', 128: 'icons/icon128.png',
};
let animTimer = null;

function startScanAnimation(tabId) {
  stopScanAnimation();
  let f = 0;
  chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  animTimer = setInterval(() => {
    chrome.action.setIcon({ tabId, path: `icons/scan/f${f % SCAN_FRAMES}.png` })
      .catch(() => {});
    f++;
  }, 90);
}

function stopScanAnimation(tabId) {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
  if (tabId != null) chrome.action.setIcon({ tabId, path: IDLE_ICON }).catch(() => {});
}

async function setBadge(tabId, kind) {
  const b = BADGE[kind] || BADGE.error;
  try {
    await chrome.action.setBadgeText({ tabId, text: b.text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: b.color });
  } catch { /* tab closed */ }
}

/** Injected into the page itself — must be self-contained. */
function showWarning(label, probs) {
  if (document.getElementById('__pc_warn')) return;
  const pct = Math.round((probs[label] || 0) * 100);
  const wrap = document.createElement('div');
  wrap.id = '__pc_warn';
  Object.assign(wrap.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647',
    background: 'rgba(10,12,16,.97)', color: '#fff', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    font: '16px/1.5 -apple-system,system-ui,sans-serif', textAlign: 'center',
  });
  const h = document.createElement('div');
  h.textContent = label === 'nsfw' ? 'Adult content blocked' : 'Suspicious page blocked';
  Object.assign(h.style, { fontSize: '26px', fontWeight: '700', marginBottom: '10px' });
  const p = document.createElement('div');
  p.textContent = `Classified as ${label} (${pct}% confidence) by the on-device model.`;
  Object.assign(p.style, { color: '#aeb6c2', marginBottom: '22px' });
  const btn = document.createElement('button');
  btn.textContent = 'Show anyway';
  Object.assign(btn.style, {
    padding: '10px 20px', borderRadius: '8px', border: '1px solid #454c59',
    background: '#252a33', color: '#e6e8eb', cursor: 'pointer', fontSize: '14px',
  });
  btn.onclick = () => wrap.remove();
  wrap.append(h, p, btn);
  document.documentElement.appendChild(wrap);
}

async function scanTab(tabId, url, force = false) {
  const now = Date.now();
  if (scanning || now - lastScanAt < COOLDOWN_MS) return;
  // A reload, an SPA route change or a big DOM swap all count as a new page,
  // so they pass force and bypass the "already judged this URL" cache.
  if (!force && RECENT.get(tabId)?.url === url) return;

  const { autoScan } = await getSettings();
  if (!autoScan) return;

  // Allowed sites are skipped entirely: not captured, not scanned, not recorded.
  let host = '';
  try { host = new URL(url).hostname; } catch { /* not a normal page */ }
  if (host && isAllowed(host, await getAllowList())) {
    RECENT.set(tabId, { url, verdict: { label: 'allowed' } });
    await setBadge(tabId, 'allowed');
    return;
  }

  scanning = true;
  lastScanAt = now;
  startScanAnimation(tabId);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) return;                       // captureVisibleTab needs the active tab

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    await ensureOffscreen();
    const res = await chrome.runtime.sendMessage({ type: 'classify', dataUrl });

    if (!res || res.error) {
      await setBadge(tabId, 'error');
      RECENT.set(tabId, { url, verdict: { label: 'error', error: res?.error } });
      return;
    }

    RECENT.set(tabId, { url, verdict: res });
    await setBadge(tabId, res.label);

    if (res.label !== 'normal') await recordFlagged(url, res);   // history: flagged only

    const { blockFlagged } = await getSettings();
    if (blockFlagged && res.label !== 'normal') {
      chrome.scripting.executeScript({
        target: { tabId },
        func: showWarning,
        args: [res.label, res.probs],
      }).catch(() => { /* restricted page */ });
    }
  } catch (e) {
    console.warn('scan failed:', e);
    await setBadge(tabId, 'error');
  } finally {
    stopScanAnimation(tabId);
    scanning = false;
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  // A page starting to load invalidates whatever we decided about this tab,
  // which is what makes reloads and normal navigation re-scan.
  if (info.status === 'loading') { RECENT.delete(tabId); return; }
  if (info.status !== 'complete') return;
  if (!tab.url || !/^https?:/.test(tab.url)) return;
  // let late-rendering popups and modals appear before capturing
  setTimeout(() => scanTab(tabId, tab.url, true), 1800);
});

// SPA navigations never reload the document, so onUpdated alone would miss them.
if (chrome.webNavigation) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url, frameId }) => {
    if (frameId !== 0 || !/^https?:/.test(url)) return;
    setTimeout(() => scanTab(tabId, url, true), 1200);
  });
}

// Switching to a tab should show its verdict, re-checking if we have none.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const known = RECENT.get(tabId);
  if (known) return void setBadge(tabId, known.verdict.label);
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url && /^https?:/.test(tab.url)) scanTab(tabId, tab.url, true);
  } catch { /* tab gone */ }
});

// The content script reports big DOM changes, ajax content and route changes.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type !== 'pageChanged' || !sender.tab) return false;
  const { id, url } = sender.tab;
  if (url && /^https?:/.test(url)) scanTab(id, url, true);
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => RECENT.delete(tabId));

// The toolbar icon opens the settings page; there is no popup any more.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// Adding or removing an allowed site should take effect without a browser restart.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.allowList) RECENT.clear();
});
