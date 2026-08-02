/**
 * Popup: shows whatever the background auto-scan already decided for this tab,
 * plus the two toggles and a manual re-scan. The heavy lifting lives in
 * background.js + offscreen.js so it keeps working with the popup closed.
 */
const $ = (id) => document.getElementById(id);

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text; // never innerHTML: some strings come from the page
  return n;
};

function render(v) {
  const out = $('out');
  out.replaceChildren();

  if (!v) {
    out.append(el('div', 'note', 'No verdict for this tab yet. Reload the page, or press Re-scan.'));
    return;
  }
  if (v.label === 'error' || v.error) {
    out.append(el('div', 'err', `Scan failed: ${v.error || 'unknown error'}`));
    return;
  }

  out.append(el('div', `verdict ${v.label}`, v.label.toUpperCase()));

  const bars = el('div', 'bars');
  for (const [c, p] of Object.entries(v.probs).sort((a, b) => b[1] - a[1])) {
    const row = el('div', 'row');
    const track = el('span', 'track');
    const fill = el('span', 'fill');
    fill.style.width = `${(p * 100).toFixed(1)}%`;
    track.append(fill);
    row.append(el('span', null, c), track, el('span', 'pct', `${(p * 100).toFixed(1)}%`));
    bars.append(row);
  }
  out.append(bars, el('div', 'note',
    `5 image views (1 whole page + 4 native-resolution crops) fused with ` +
    `${v.ocrChars} characters of OCR text.`));
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refresh() {
  const tab = await currentTab();
  if (!tab) return;
  const v = await chrome.runtime.sendMessage({ type: 'getVerdict', tabId: tab.id });
  render(v);
}

(async () => {
  const { autoScan = true, blockFlagged = true } =
    await chrome.storage.local.get(['autoScan', 'blockFlagged']);
  $('autoScan').checked = autoScan;
  $('blockFlagged').checked = blockFlagged;

  $('autoScan').addEventListener('change', (e) =>
    chrome.storage.local.set({ autoScan: e.target.checked }));
  $('blockFlagged').addEventListener('change', (e) =>
    chrome.storage.local.set({ blockFlagged: e.target.checked }));

  $('rescan').addEventListener('click', async () => {
    const tab = await currentTab();
    $('out').replaceChildren(el('div', 'note', 'scanning…'));
    await chrome.runtime.sendMessage({ type: 'rescan', tabId: tab.id });
    setTimeout(refresh, 2500);   // first run also compiles the model
  });

  refresh();
})();
