/**
 * Content script, document_start: blurs the page until the service worker has a
 * verdict, so nothing is visible during the seconds the scan takes.
 *
 * The blur sits on <body> only. The warning overlay is appended to <html>, so it
 * stays sharp on top of a page that is still blurred underneath.
 *
 * The classifier works from a screenshot, so the blur must come off for the instant
 * of each capture ("peek") or the model would only ever see blur.
 */

const CLS = '__g_blur';
// The block overlay background.js injects, held in the isolated world as
// globalThis.__gWarn. Never look it up by id: a page could plant a fake one.
const warned = () => !!globalThis.__gWarn?.isConnected;
const FAILSAFE_MS = 15000;
let held = true;                       // still waiting for a verdict
let enabled = true;                    // the parent's "blur until checked" setting
let failsafe = null;

const style = document.createElement('style');
style.textContent = `
  html.${CLS} > body { filter: blur(40px) !important; pointer-events: none !important; }
  html.${CLS}::after {
    content: 'Guardian is checking this page\\2026'; position: fixed; z-index: 2147483646;
    left: 50%; top: 50%; transform: translate(-50%,-50%); padding: 12px 20px;
    border-radius: 999px; background: #13211aee; color: #fff;
    font: 600 14px -apple-system,system-ui,sans-serif;
  }`;
document.documentElement.append(style);

const release = () => {
  held = false; clearTimeout(failsafe);
  document.documentElement.classList.remove(CLS);
};
// ponytail: fail open if no verdict ever arrives (worker crashed, extension
// reloaded). Same choice as a scan error. Raise FAILSAFE_MS if that is too lenient.
const hold = () => {
  if (!enabled) return;
  held = true; document.documentElement.classList.add(CLS);
  clearTimeout(failsafe); failsafe = setTimeout(release, FAILSAFE_MS);
};
const frames = (n) => new Promise((r) => {
  const step = () => (n-- > 0 ? requestAnimationFrame(step) : r());
  step();
});

chrome.storage.local.get('blurUntilChecked')
  .then(({ blurUntilChecked }) => { if (blurUntilChecked === false) { enabled = false; release(); } })
  .catch(release);

hold();

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === 'g:peek') {        // unblur just long enough to be captured
    // blocked page: the warning stays, nothing to capture, keep the blur
    if (warned()) { respond({ warned: true }); return false; }
    document.documentElement.classList.remove(CLS);
    // Two frames was not enough on heavy pages (YouTube): the GPU was still
    // compositing the blurred layer and the capture caught blur. Give it a beat.
    frames(2).then(() => setTimeout(() => respond({ warned: false }), msg.wait ?? 120));
    return true;
  }
  if (msg?.type === 'g:hold') {        // capture done; back under blur if undecided
    if (held) document.documentElement.classList.add(CLS);
    return false;
  }
  if (msg?.type === 'g:release') { release(); return false; }
  // SPA route change (dev.to, YouTube...): new page, same document, so blur again.
  // A stale warning would cover the new page and get captured, so drop it too.
  if (msg?.type === 'g:blur') { globalThis.__gWarn?.remove(); hold(); return false; }
  return false;
});
