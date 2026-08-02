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
let lastPing = 0;
let lastUrl = location.href;

function ping(reason) {
  const now = Date.now();
  if (now - lastPing < MIN_GAP_MS) return;
  lastPing = now;
  chrome.runtime.sendMessage({ type: 'pageChanged', reason }).catch(() => {
    /* service worker asleep — it will pick the page up on the next event */
  });
}

// Structural change: a lot of new nodes appearing at once.
new MutationObserver((records) => {
  let added = 0;
  for (const r of records) added += r.addedNodes.length;
  if (added < MIN_NODES) return;
  clearTimeout(timer);
  timer = setTimeout(() => ping('dom'), QUIET_MS);
}).observe(document.documentElement, { childList: true, subtree: true });

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
