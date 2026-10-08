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
const FAILSAFE_MS = 15000;
let held = true;                       // still waiting for a verdict

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
document.documentElement.classList.add(CLS);

const release = () => { held = false; document.documentElement.classList.remove(CLS); };
const frames = (n) => new Promise((r) => {
  const step = () => (n-- > 0 ? requestAnimationFrame(step) : r());
  step();
});

chrome.storage.local.get('blurUntilChecked')
  .then(({ blurUntilChecked }) => { if (blurUntilChecked === false) release(); })
  .catch(release);

// ponytail: fail open if no verdict ever arrives (worker crashed, extension
// reloaded). Same choice as a scan error. Raise FAILSAFE_MS if that is too lenient.
setTimeout(release, FAILSAFE_MS);

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === 'g:peek') {        // unblur just long enough to be captured
    document.documentElement.classList.remove(CLS);
    frames(2).then(() => respond(true));
    return true;
  }
  if (msg?.type === 'g:hold') {        // capture done; back under blur if undecided
    if (held) document.documentElement.classList.add(CLS);
    return false;
  }
  if (msg?.type === 'g:release') { release(); return false; }
  return false;
});
