/**
 * Service worker: watches navigation, scans each page automatically, and warns.
 *
 * The heavy work (Tesseract + LiteRT) runs in an offscreen document because a MV3
 * service worker has no DOM and gets torn down aggressively — an offscreen page can
 * hold the compiled model in memory across navigations instead of recompiling it
 * every time.
 */

const OFFSCREEN = 'offscreen.html';
const RECENT = new Map();          // tabId -> { url, verdict }
const COOLDOWN_MS = 4000;
let lastScanAt = 0;
let scanning = false;

const BADGE = {
  normal: { text: 'OK', color: '#2f9e44' },
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

async function scanTab(tabId, url) {
  const now = Date.now();
  if (scanning || now - lastScanAt < COOLDOWN_MS) return;
  if (RECENT.get(tabId)?.url === url) return;      // already judged this page

  const { autoScan = true } = await chrome.storage.local.get('autoScan');
  if (!autoScan) return;

  scanning = true;
  lastScanAt = now;
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

    const { blockFlagged = true } = await chrome.storage.local.get('blockFlagged');
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
    scanning = false;
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!tab.url || !/^https?:/.test(tab.url)) return;
  // let late-rendering popups and modals appear before capturing
  setTimeout(() => scanTab(tabId, tab.url), 1800);
});

chrome.tabs.onRemoved.addListener((tabId) => RECENT.delete(tabId));

// The popup asks for whatever we already decided about the visible tab.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === 'getVerdict') {
    respond(RECENT.get(msg.tabId)?.verdict || null);
    return true;
  }
  if (msg.type === 'rescan') {
    RECENT.delete(msg.tabId);
    lastScanAt = 0;
    chrome.tabs.get(msg.tabId).then((t) => scanTab(msg.tabId, t.url));
    respond({ ok: true });
    return true;
  }
  return false;
});
