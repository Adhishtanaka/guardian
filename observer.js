/**
 * Content script: tells the service worker when a page has changed enough to be
 * worth looking at again.
 *
 * Needed because tabs.onUpdated fires on document load, which misses most of what
 * actually happens on the modern web — single-page-app route changes, infinite
 * scroll, content swapped in after an ajax call, and pop-ups injected seconds later.
 * Without this, Guardian judges a page once and never looks again.
 */

const QUIET_MS = 1200;    // wait for the burst of mutations to settle
const MIN_GAP_MS = 8000;  // never nag the background more often than this
const MIN_NODES = 12;     // ignore small text/attribute churn

let timer = null;
let videoTimer = null;
let lastPing = 0;
let lastUrl = location.href;

function ping(reason) {
  const now = Date.now();
  if (now - lastPing < MIN_GAP_MS) return;
  if (globalThis.__gWarn?.isConnected) return;   // blocked; the overlay itself is DOM churn
  lastPing = now;
  send('pageChanged', reason);
}

let orphaned = false;

/**
 * Reloading or updating the extension orphans every content script already running
 * in a page. chrome.runtime.id becomes undefined and the next sendMessage throws
 * "Extension context invalidated" SYNCHRONOUSLY, which .catch() cannot see, so it
 * surfaces as an uncaught error on every open tab. Check first, guard anyway, and
 * shut everything down permanently once it happens.
 */
function send(type, reason) {
  if (orphaned) return;
  if (!chrome.runtime?.id) { teardown(); return; }
  try {
    chrome.runtime.sendMessage({ type, reason }).catch(() => {
      /* service worker asleep - it will pick the page up on the next event */
    });
  } catch {
    teardown();
  }
}

function teardown() {
  orphaned = true;
  if (videoTimer) { clearInterval(videoTimer); videoTimer = null; }
  if (timer) { clearTimeout(timer); timer = null; }
  if (domObserver) { domObserver.disconnect(); domObserver = null; }
}

// Structural change: a lot of new nodes appearing at once.
let domObserver = new MutationObserver((records) => {
  let added = 0;
  for (const r of records) added += r.addedNodes.length;
  if (added < MIN_NODES) return;
  clearTimeout(timer);
  timer = setTimeout(() => ping('dom'), QUIET_MS);
});
domObserver.observe(document.documentElement, { childList: true, subtree: true });

// SPA route changes that never reload the document.
const seeUrl = () => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  lastPing = 0;                       // a real navigation always deserves a look
  clearTimeout(timer);
  timer = setTimeout(() => ping('spa'), 600);
};
addEventListener('popstate', seeUrl);
addEventListener('hashchange', seeUrl);
for (const m of ['pushState', 'replaceState']) {
  const orig = history[m];
  history[m] = function (...args) { const r = orig.apply(this, args); seeUrl(); return r; };
}

// Coming back to a backgrounded tab is a good moment to re-check.
addEventListener('visibilitychange', () => { if (!document.hidden) ping('visible'); });

/**
 * Video needs its own timer. While a video plays, the page does not navigate and
 * its DOM barely changes, so neither the navigation events nor the mutation
 * observer above will ever fire again — yet the thing on screen is completely
 * different a minute later. Nothing else in the extension would notice.
 */
function anyVideoPlaying() {
  for (const v of document.querySelectorAll('video')) {
    if (!v.paused && !v.ended && v.readyState > 2 && v.currentTime > 0) return true;
  }
  return false;
}

async function startVideoWatch() {
  if (orphaned || videoTimer) return;
  let s = null;
  try {
    s = await chrome.runtime.sendMessage({ type: 'getSettings' }).catch(() => null);
  } catch { teardown(); return; }
  const secs = s?.videoRescanSeconds ?? 20;
  if (!secs) return;

  send('videoStarted', 'video');            // change the icon now, not in 20s
  videoTimer = setInterval(() => {
    if (document.hidden) return;            // never scan a hidden tab
    if (!anyVideoPlaying()) {               // playback ended or was paused
      clearInterval(videoTimer); videoTimer = null;
      send('videoStopped', 'video');
      return;
    }
    // Its own message type rather than ping(), because a timed check must not be
    // swallowed by the debounce that protects ordinary pages.
    send('videoTick', 'video');
  }, secs * 1000);
}

// Only start the timer once a video actually plays, so ordinary pages pay nothing.
document.addEventListener('play', startVideoWatch, true);
// Videos already playing when the script loads (a reloaded tab, a restored session).
setTimeout(() => { if (anyVideoPlaying()) startVideoWatch(); }, 3000);
