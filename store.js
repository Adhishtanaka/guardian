/**
 * Guardian's persisted state: settings, allow list, activity history.
 *
 * The pure functions (hostMatches, isAllowed, pushHistory) take no chrome.* so they
 * can be unit-tested in Node; only the read/write wrappers touch chrome.storage.
 */

export const DEFAULTS = {
  autoScan: true,
  blockFlagged: true,
  theme: 'system',      // system | light | dark
  tourDone: false,
};

export const HISTORY_CAP = 500;
const PATH_CAP = 120;

// --- pure logic -----------------------------------------------------------

/**
 * Does `host` fall under an allow-list rule?
 *
 * Subdomain matching only counts on a LABEL BOUNDARY. A naive endsWith() would let
 * "notexample.com" and "example.com.evil.net" both match "example.com", which is
 * exactly how an allow list becomes a hole.
 */
export function hostMatches(host, rule, includeSubdomains) {
  if (!host || !rule) return false;
  const h = String(host).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const r = String(rule).toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  if (h === r) return true;
  if (!includeSubdomains) return false;
  return h.endsWith('.' + r);   // the leading dot is what enforces the boundary
}

export function isAllowed(host, allowList = []) {
  return allowList.some((e) => hostMatches(host, e.domain, e.includeSubdomains));
}

export function normalizeDomain(input) {
  let s = String(input || '').trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, '').split('/')[0].split(':')[0]
       .replace(/^www\./, '').replace(/\.$/, '');
  // must look like a hostname: at least one dot, no spaces, valid characters
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s;
}

/** Newest first, capped. Pure so the cap behaviour is testable. */
export function pushHistory(history, entry, cap = HISTORY_CAP) {
  return [entry, ...history].slice(0, cap);
}

export function makeHistoryEntry(url, verdict, now = Date.now()) {
  let host = '', path = '';
  try {
    const u = new URL(url);
    host = u.hostname;
    path = (u.pathname + u.search).slice(0, PATH_CAP);
  } catch { host = String(url).slice(0, PATH_CAP); }
  return {
    ts: now,
    host,
    path,
    label: verdict.label,
    confidence: Number((verdict.probs?.[verdict.label] ?? 0).toFixed(4)),
  };
}

// --- chrome.storage wrappers ---------------------------------------------

export async function getSettings() {
  const got = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...got };
}

export const setSettings = (patch) => chrome.storage.local.set(patch);

export async function getAllowList() {
  const { allowList = [] } = await chrome.storage.local.get('allowList');
  return allowList;
}

export const setAllowList = (allowList) => chrome.storage.local.set({ allowList });

export async function getHistory() {
  const { history = [] } = await chrome.storage.local.get('history');
  return history;
}

export async function recordFlagged(url, verdict) {
  const history = await getHistory();
  await chrome.storage.local.set({
    history: pushHistory(history, makeHistoryEntry(url, verdict)),
  });
}

export const clearHistory = () => chrome.storage.local.set({ history: [] });

export async function getPinRecord() {
  const { pinRecord = null } = await chrome.storage.local.get('pinRecord');
  return pinRecord;
}

export const setPinRecord = (pinRecord) => chrome.storage.local.set({ pinRecord });

export async function getLockState() {
  const { lockState = { failedAttempts: 0, lastFailedAt: 0 } } =
    await chrome.storage.local.get('lockState');
  return lockState;
}

export const setLockState = (lockState) => chrome.storage.local.set({ lockState });
