/**
 * Service worker: watches navigation, scans each page automatically, and warns.
 *
 * The heavy work (Tesseract + LiteRT) runs in an offscreen document because a MV3
 * service worker has no DOM and gets torn down aggressively — an offscreen page can
 * hold the compiled model in memory across navigations instead of recompiling it
 * every time.
 */

import {
  getSettings, getAllowList, getBlockList, decideList, recordFlagged,
  setAllowList, normalizeDomain, getPinRecord, getLockState, setLockState,
} from './store.js';
import { verifyPin, remainingLockout } from './auth.js';

const OFFSCREEN = 'offscreen.html';
const RECENT = new Map();          // tabId -> { url, verdict }
const BYPASS = new Set();          // "tabId|url" the parent unlocked with the PIN
const VIDEO_TABS = new Set();      // tabs where a video is playing and being watched
let LAST_SCAN = null;              // diagnostics for the settings page
const bypassKey = (tabId, url) => `${tabId}|${url}`;
const COOLDOWN_MS = 4000;
let lastScanAt = 0;
let scanning = false;

// Each verdict gets its own icon as well as a badge — colour on the icon is
// readable at a glance, where a 3-character badge is not.
const STATE = {
  normal:    { text: 'OK',  color: '#16a34a', title: 'This page looks fine' },
  allowed:   { text: '',    color: '#64748b', title: 'Allowed site — not scanned' },
  nsfw:      { text: '18+', color: '#dc2626', title: 'Adult content detected' },
  malicious: { text: '!',   color: '#ea580c', title: 'Suspicious page detected' },
  error:     { text: '?',   color: '#94a3b2', title: "Couldn't check this page" },
  video:     { text: '\u25B6', color: '#0ea5e9',
               title: 'Video playing - re-checking on a timer' },
};
const statePath = (name) => Object.fromEntries(
  [16, 32, 48, 128].map((s) => [s, `icons/state/${name}${s}.png`]));

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

// chrome.action.setIcon({ path }) loads the image in its JS binding, and if the tab
// closed meanwhile it reports "No tab with id" as an unchecked lastError that
// .catch() never sees. Check the tab first.
// ponytail: still a tiny race between get() and setIcon(); preload ImageData if it matters.
async function setIcon(tabId, path) {
  try { await chrome.tabs.get(tabId); } catch { return false; }
  await chrome.action.setIcon({ tabId, path }).catch(() => {});
  return true;
}

function startScanAnimation(tabId) {
  stopScanAnimation();
  let f = 0;
  chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  animTimer = setInterval(async () => {
    if (!(await setIcon(tabId, `icons/scan/f${f % SCAN_FRAMES}.png`))) stopScanAnimation();
    f++;
  }, 90);
}

// Only stops the timer. It must NOT restore an icon: setBadge has usually already
// painted the verdict icon by this point, and resetting here would wipe it.
function stopScanAnimation() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
}

async function setBadge(tabId, kind) {
  // A clean page that is playing video shows the video state instead, so the parent
  // can see it is being watched on a timer. A flagged verdict always wins: safety
  // information must never be replaced by status information.
  if (kind === 'normal' && VIDEO_TABS.has(tabId)) kind = 'video';
  const st = STATE[kind] || STATE.error;
  const name = STATE[kind] ? kind : 'error';
  try {
    if (!(await setIcon(tabId, statePath(name)))) return;
    await chrome.action.setBadgeText({ tabId, text: st.text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: st.color });
    await chrome.action.setTitle({ tabId, title: `Guardian — ${st.title}` });
  } catch { /* tab closed */ }
}

/**
 * Injected into the blocked page. Must be entirely self-contained — it runs in the
 * page's isolated world, so it can only reach the extension through messaging.
 *
 * "Show anyway" is the bypass, so it asks for the PIN. The PIN is never checked here:
 * it is sent to the service worker, which owns the hash. Nothing secret is exposed
 * to a page that might be hostile.
 */
function showWarning(label, probs, host) {
  // The page can fake an element id, but not this: executeScript runs in the
  // extension's isolated world, the same globals blur.js and observer.js see.
  if (globalThis.__gWarn?.isConnected) return;
  const pct = Math.round((probs?.[label] || 0) * 100);
  const S = (n, css) => Object.assign(n.style, css);
  const mk = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css) S(n, css);
    if (text != null) n.textContent = text;
    return n;
  };

  const wrap = mk('div', {
    position: 'fixed', inset: '0', zIndex: '2147483647',
    background: '#0d1512f2', backdropFilter: 'blur(6px)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    font: '15px/1.55 -apple-system,system-ui,sans-serif',
  });
  wrap.id = '__g_warn';
  globalThis.__gWarn = wrap;

  const card = mk('div', {
    background: '#ffffff', color: '#13211a', borderRadius: '16px', padding: '30px 32px',
    width: 'min(420px,92vw)', textAlign: 'center', boxShadow: '0 20px 60px #0006',
  });

  const bad = label === 'nsfw' ? '#dc2626' : '#ea580c';
  const dot = mk('div', {
    width: '54px', height: '54px', borderRadius: '50%', margin: '0 auto 16px',
    background: label === 'nsfw' ? '#fdeaea' : '#fdf0e6', color: bad,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '26px', fontWeight: '700',
  }, label === 'nsfw' ? '\u2715' : '!');

  const title = mk('div', { fontSize: '20px', fontWeight: '700', marginBottom: '6px' },
    label === 'nsfw' ? 'Adult content blocked' : 'Suspicious page blocked');
  const sub = mk('div', { color: '#5e6f66', fontSize: '13.5px', marginBottom: '22px' },
    `${host || 'This page'} — ${pct}% confidence, checked on this device.`);

  const btn = (text, primary) => mk('button', {
    font: 'inherit', fontSize: '14px', fontWeight: '600', cursor: 'pointer', width: '100%',
    padding: '11px', borderRadius: '9px', marginTop: '8px',
    border: primary ? '1px solid #16a34a' : '1px solid #e1e8e4',
    background: primary ? '#16a34a' : '#fff', color: primary ? '#fff' : '#13211a',
  }, text);

  const back = btn('Go back', true);
  back.onclick = () => history.length > 1 ? history.back() : window.close();
  const showBtn = btn('Show anyway (needs PIN)');

  const step2 = mk('div', { display: 'none', marginTop: '10px' });
  const pin = mk('input');
  Object.assign(pin, { type: 'password', inputMode: 'numeric', maxLength: 8, placeholder: 'PIN' });
  S(pin, {
    width: '100%', padding: '11px', fontSize: '18px', textAlign: 'center', letterSpacing: '6px',
    border: '1px solid #e1e8e4', borderRadius: '9px', background: '#f8faf9', color: '#13211a',
  });
  const err = mk('div', { color: '#dc2626', fontSize: '12.5px', minHeight: '18px', marginTop: '6px' });
  const unlockBtn = btn('Unlock', true);
  step2.append(pin, err, unlockBtn);

  const step3 = mk('div', { display: 'none', marginTop: '10px' });
  step3.append(mk('div', { color: '#5e6f66', fontSize: '13px', marginBottom: '4px' },
    'PIN accepted. How long should this be allowed?'));
  const onceBtn = btn('Just this once');
  const alwaysBtn = btn('Always allow ' + (host || 'this site'), true);
  step3.append(onceBtn, alwaysBtn);

  card.append(dot, title, sub, back, showBtn, step2, step3);
  wrap.append(card);
  document.documentElement.appendChild(wrap);

  showBtn.onclick = () => { showBtn.style.display = 'none'; step2.style.display = 'block'; pin.focus(); };

  const tryPin = async () => {
    err.textContent = '';
    const res = await chrome.runtime.sendMessage({ type: 'verifyPin', pin: pin.value })
      .catch(() => ({ ok: false, error: 'Guardian is not responding.' }));
    if (res?.ok) { step2.style.display = 'none'; step3.style.display = 'block'; return; }
    pin.value = '';
    err.textContent = res?.waitMs
      ? `Too many attempts. Wait ${Math.ceil(res.waitMs / 1000)}s.`
      : (res?.error || 'Incorrect PIN.');
  };
  unlockBtn.onclick = tryPin;
  pin.onkeydown = (e) => { if (e.key === 'Enter') tryPin(); };

  // also lift the "checking" blur that blur.js left under the warning
  const reveal = () => { wrap.remove(); document.documentElement.classList.remove('__g_blur'); };
  onceBtn.onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'bypassOnce', url: location.href }).catch(() => {});
    reveal();
  };
  alwaysBtn.onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'allowAlways', host }).catch(() => {});
    reveal();
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Messages to blur.js. A tab without it (restricted page, opened before install)
// just rejects, which is fine.
const tell = (tabId, type) => chrome.tabs.sendMessage(tabId, { type }).catch(() => {});
const PENDING = new Set();         // tabs with a scan queued behind the cooldown

// A capture that still caught the blur is meaningless, so look again with a longer
// unblur. ponytail: two tries; after that the verdict stands as captured.
async function capture(tab, opts) {
  const res = await captureOnce(tab, opts, 120);
  if (!res?.blurred || res.skipped) return res;
  console.warn('[Guardian] capture caught the blur, retrying');
  return captureOnce(tab, opts, 400);
}

async function captureOnce(tab, opts, wait) {
  // A tab can close between the scan starting and the capture, which surfaces as
  // "Unchecked runtime.lastError: No tab with id". Confirm it is still there.
  try {
    await chrome.tabs.get(tab.id);
  } catch {
    return { error: 'tab closed' };
  }
  // blur.js keeps the page blurred until a verdict, so lift it for the capture or
  // the model would be classifying blur.
  // blur.js answers whether our warning is on screen. If it is, a capture would
  // classify the warning card itself (a dark page with a dialog reads as
  // "malicious"), so a blocked page is never re-scanned. Asking the page rather than
  // keeping a set here survives the service worker being restarted.
  const peek = await chrome.tabs.sendMessage(tab.id, { type: 'g:peek', wait }).catch(() => null);
  if (peek?.warned) return { skipped: 'warning on screen' };
  let dataUrl;
  try {
    // Chrome refuses captures while the tab strip is busy (a drag, or YouTube's
    // fullscreen/miniplayer churn): "Tabs cannot be edited right now". It is
    // momentary, so retry briefly instead of failing the scan open.
    for (let i = 0; ; i++) {
      try {
        dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        break;
      } catch (e) {
        if (i >= 4 || !/cannot be edited right now/i.test(e?.message)) throw e;
        await sleep(250);
      }
    }
  } finally {
    tell(tab.id, 'g:hold');
  }
  const res = await chrome.runtime.sendMessage({ type: 'classify', dataUrl, opts: { ...opts, debug: DEBUG } });
  if (DEBUG) logScan(tab.url, dataUrl, res);
  if (res) delete res.debug;               // don't keep megabytes of images in RECENT
  return res;
}

// Logs every screenshot and its OCR text, so only for unpacked dev installs:
// a Web Store install has update_url in its manifest and never logs.
const DEBUG = !('update_url' in chrome.runtime.getManifest());
const img = (url, w, h) => console.log('%c ', `font-size:1px;padding:${h / 2}px ${w / 2}px;` +
  `background:url(${url}) no-repeat center/contain`);

function logScan(url, shot, res) {
  const d = res?.debug;
  console.groupCollapsed(`[Guardian] ${res?.label ?? 'ERROR'} ${url}`,
    res?.probs ? Object.fromEntries(Object.entries(res.probs).map(([k, v]) => [k, +v.toFixed(3)])) : res);
  console.log('screenshot (what was captured)', d?.size);
  img(shot, 480, 300);
  if (d) {
    console.log('model views: [0] whole page letterboxed, [1-4] quadrants');
    d.views.forEach((v) => img(v, 160, 160));
    console.log('logits', d.logits, 'rule hits', d.rules);
    console.log(`OCR (${d.ocrText.length} chars):`, d.ocrText.slice(0, 600));
  }
  console.groupEnd();
}

/**
 * Combine two scans of the same page, safety first: take the higher probability for
 * each risky class. A page that looked unsafe in either frame is treated as unsafe,
 * and one that looked safe twice keeps its safe verdict.
 */
function mergeVerdicts(a, b) {
  const probs = {};
  for (const k of Object.keys(a.probs)) probs[k] = Math.max(a.probs[k], b.probs[k]);
  const risky = ['nsfw', 'malicious'].filter((c) => a.label === c || b.label === c);
  const label = risky.length
    ? risky.reduce((x, y) => (probs[x] >= probs[y] ? x : y))
    : a.label;
  return { ...a, probs, label, confirmed: a.label === b.label, scans: 2 };
}

async function scanTab(tabId, url, force = false) {
  const now = Date.now();
  if (scanning || now - lastScanAt < COOLDOWN_MS) {
    // Dropping the scan would leave a freshly loaded page blurred until the
    // failsafe, so queue one retry per tab instead.
    if (!PENDING.has(tabId)) {
      PENDING.add(tabId);
      setTimeout(() => { PENDING.delete(tabId); scanTab(tabId, url, force); }, COOLDOWN_MS);
    }
    return;
  }
  // A reload, an SPA route change or a big DOM swap all count as a new page,
  // so they pass force and bypass the "already judged this URL" cache.
  const known = RECENT.get(tabId);
  if (!force && known?.url === url) {
    if (known.verdict.label !== 'nsfw' && known.verdict.label !== 'malicious') {
      tell(tabId, 'g:release');
    }
    return;
  }

  const settings = await getSettings();
  if (!settings.autoScan) return void tell(tabId, 'g:release');

  let host = '';
  try { host = new URL(url).hostname; } catch { /* not a normal page */ }

  // A parent's explicit decision outranks the model, so the lists are checked first
  // and the page is never captured or classified at all.
  if (host) {
    const listed = decideList(host, await getAllowList(), await getBlockList());
    if (listed === 'allowed') {
      RECENT.set(tabId, { url, verdict: { label: 'allowed' } });
      await setBadge(tabId, 'allowed');
      tell(tabId, 'g:release');
      return;
    }
    if (listed === 'blocked') {
      const verdict = { label: 'malicious', probs: { malicious: 1, normal: 0, nsfw: 0 },
                        blockedByList: true };
      RECENT.set(tabId, { url, verdict });
      await setBadge(tabId, 'malicious');
      await recordFlagged(url, verdict);
      if (!BYPASS.has(bypassKey(tabId, url))) {
        chrome.scripting.executeScript({
          target: { tabId }, func: showWarning, args: ['malicious', verdict.probs, host],
        }).catch(() => {});
      }
      return;
    }
  }

  scanning = true;
  lastScanAt = now;
  startScanAnimation(tabId);
  let painted = false;                             // did we set a verdict icon?
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) return;                       // captureVisibleTab needs the active tab

    const opts = settings.safetyNet ? {
      ruleBoost: settings.ruleBoostOverride,
      nsfwThreshold: settings.nsfwThreshold,
      maliciousThreshold: settings.maliciousThreshold,
    } : {};

    await ensureOffscreen();
    let res = await capture(tab, opts);

    // Confirmation scan. A single frame can be wrong for reasons that have nothing
    // to do with the model: the page was still painting, a video was mid-transition,
    // or OCR caught the page before the text rendered. Rather than act on one frame,
    // look again and take the more cautious of the two.
    if (settings.confirmScan && res && !res.error
        && (res.label !== 'normal' || res.uncertain)) {
      await sleep(900);
      const second = await capture(tab, opts);
      if (second && !second.error && !second.skipped) {
        res = mergeVerdicts(res, second);
      }
    }

    if (res?.skipped) { painted = true; return; }   // blocked page: keep its verdict
    if (!res || res.error) {
      tell(tabId, 'g:release');        // fail open, as the page always did on error
      await setBadge(tabId, 'error'); painted = true;
      RECENT.set(tabId, { url, verdict: { label: 'error', error: res?.error } });
      return;
    }

    RECENT.set(tabId, { url, verdict: res });
    await setBadge(tabId, res.label); painted = true;

    // Keep the last scan so the settings page can show what actually happened.
    // Without this a wrong verdict is unexplainable: there is no way to tell a
    // model that disagrees from OCR that returned nothing at all.
    LAST_SCAN = {
      at: Date.now(), host, label: res.label, probs: res.probs,
      ocrChars: res.ocrChars, ruleFired: !!res.ruleFired,
      scans: res.scans || 1, confirmed: res.confirmed,
      safetyNet: !!settings.safetyNet,
    };
    chrome.storage.local.set({ lastScan: LAST_SCAN }).catch(() => {});

    if (res.label !== 'normal') await recordFlagged(url, res);   // history: flagged only

    const { blockFlagged } = await getSettings();
    // a one-time "show anyway" survives until the tab navigates elsewhere
    if (blockFlagged && res.label !== 'normal' && !BYPASS.has(bypassKey(tabId, url))) {
      // stays blurred underneath the warning
      chrome.scripting.executeScript({
        target: { tabId },
        func: showWarning,
        args: [res.label, res.probs, host],
      }).catch(() => { /* restricted page */ });
    } else {
      tell(tabId, 'g:release');
    }
  } catch (e) {
    console.warn('scan failed:', e);
    tell(tabId, 'g:release');
    await setBadge(tabId, 'error'); painted = true;
  } finally {
    stopScanAnimation();
    // nothing decided (e.g. tab went inactive mid-scan) — leave the plain shield
    if (!painted) setIcon(tabId, IDLE_ICON);
    scanning = false;
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  // A page starting to load invalidates whatever we decided about this tab,
  // which is what makes reloads and normal navigation re-scan.
  if (info.status === 'loading') {
    RECENT.delete(tabId);
    VIDEO_TABS.delete(tabId);          // a new page has no video until it says so
    // a one-time unlock applies to one page only
    for (const k of BYPASS) if (k.startsWith(`${tabId}|`)) BYPASS.delete(k);
    return;
  }
  if (info.status !== 'complete') return;
  if (!tab.url || !/^https?:/.test(tab.url)) return;
  // let late-rendering popups and modals appear before capturing
  setTimeout(() => scanTab(tabId, tab.url, true), 1800);
});

// SPA navigations never reload the document, so onUpdated alone would miss them.
if (chrome.webNavigation) {
  chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url, frameId }) => {
    if (frameId !== 0 || !/^https?:/.test(url)) return;
    if (!BYPASS.has(bypassKey(tabId, url))) tell(tabId, 'g:blur');
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

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  // The content script reports big DOM changes, ajax content and route changes.
  if (msg?.type === 'pageChanged' && sender.tab) {
    const { id, url } = sender.tab;
    if (url && /^https?:/.test(url)) scanTab(id, url, true);
    return false;
  }

  // A playing video changes what is on screen continuously while the page itself
  // never reloads and its DOM barely moves, so neither navigation nor the mutation
  // observer would ever fire again. The content script reports a tick instead.
  if (msg?.type === 'videoTick' && sender.tab) {
    const { id, url } = sender.tab;
    VIDEO_TABS.add(id);
    if (url && /^https?:/.test(url)) scanTab(id, url, true);
    return false;
  }

  // Sent as soon as a video starts, so the icon changes immediately rather than
  // waiting for the first timed re-check.
  if (msg?.type === 'videoStarted' && sender.tab) {
    VIDEO_TABS.add(sender.tab.id);
    const known = RECENT.get(sender.tab.id);
    setBadge(sender.tab.id, known?.verdict?.label || 'normal');
    return false;
  }
  if (msg?.type === 'videoStopped' && sender.tab) {
    VIDEO_TABS.delete(sender.tab.id);
    const known = RECENT.get(sender.tab.id);
    if (known) setBadge(sender.tab.id, known.verdict.label);
    return false;
  }

  if (msg?.type === 'getSettings') {
    getSettings().then(respond);
    return true;
  }

  // The blocked-page overlay asks us to check the PIN. Verification happens here
  // because the service worker owns the hash — the page never sees it.
  if (msg?.type === 'verifyPin') {
    (async () => {
      const lock = await getLockState();
      const waitMs = remainingLockout(lock);
      if (waitMs > 0) return respond({ ok: false, waitMs });
      const record = await getPinRecord();
      if (!record) return respond({ ok: false, error: 'No PIN set yet. Open Guardian settings.' });
      if (await verifyPin(msg.pin, record)) {
        await setLockState({ failedAttempts: 0, lastFailedAt: 0 });
        return respond({ ok: true });
      }
      const failedAttempts = (lock.failedAttempts || 0) + 1;
      await setLockState({ failedAttempts, lastFailedAt: Date.now() });
      respond({ ok: false, waitMs: remainingLockout({ failedAttempts, lastFailedAt: Date.now() }) });
    })();
    return true;                    // async reply
  }

  if (msg?.type === 'bypassOnce' && sender.tab) {
    BYPASS.add(bypassKey(sender.tab.id, msg.url));
    respond({ ok: true });
    return true;
  }

  if (msg?.type === 'allowAlways') {
    (async () => {
      const domain = normalizeDomain(msg.host);
      if (!domain) return respond({ ok: false });
      const list = await getAllowList();
      if (!list.some((e) => e.domain === domain)) {
        list.push({ domain, includeSubdomains: true });
        await setAllowList(list);
      }
      RECENT.clear();
      respond({ ok: true });
    })();
    return true;
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  RECENT.delete(tabId);
  VIDEO_TABS.delete(tabId);
  for (const k of BYPASS) if (k.startsWith(`${tabId}|`)) BYPASS.delete(k);
});

// The toolbar icon opens the settings page; there is no popup any more.
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// Adding or removing an allowed site should take effect without a browser restart.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.allowList || changes.blockList)) RECENT.clear();
});
