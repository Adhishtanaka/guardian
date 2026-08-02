/**
 * Offscreen worker page: owns the compiled model and the Tesseract worker so they
 * survive across navigations, and answers classify requests from the service worker.
 */
import { init, classify } from './pipeline.js';

let tesseractWorker = null;

async function getWorker() {
  if (tesseractWorker) return tesseractWorker;
  // non-literal specifier keeps esbuild from inlining Tesseract, so its worker and
  // wasm keep resolving against the extension's own URLs
  const mod = await import(chrome.runtime.getURL('lib/tesseract/tesseract.esm.min.js'));
  // The bundled ESM build ends with `export { tesseract_min as default }` and has NO
  // named exports, so destructuring createWorker from the namespace gives undefined
  // and OCR fails with "createWorker is not a function" - silently, because the
  // caller falls back to image-only. Take it off the default export.
  const createWorker = mod.createWorker || mod.default?.createWorker;
  if (typeof createWorker !== 'function') {
    throw new Error('Tesseract createWorker not found on the module');
  }
  tesseractWorker = await createWorker('eng', 1, {
    workerPath: chrome.runtime.getURL('lib/tesseract/worker.min.js'),
    langPath: chrome.runtime.getURL('lib/tesseract'),
    corePath: chrome.runtime.getURL('lib/tesseract'),
    gzip: true,
  });
  return tesseractWorker;
}

async function run(dataUrl, opts) {
  await init();
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());

  let text = '';
  try {
    const { data } = await (await getWorker()).recognize(dataUrl);
    text = data.text || '';
  } catch (e) {
    // The image branch alone still works; the model was trained with 15% text-dropout
    // exactly so it degrades gracefully when OCR is unavailable.
    console.warn('OCR failed, image-only:', e);
  }
  return classify(bitmap, text, opts || {});
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type !== 'classify') return false;
  run(msg.dataUrl, msg.opts)
    .then(respond)
    .catch((e) => respond({ error: String(e?.message || e) }));
  return true;   // keep the channel open for the async reply
});
