/**
 * Offscreen worker page: owns the compiled model and the Tesseract worker so they
 * survive across navigations, and answers classify requests from the service worker.
 */
import { init, classify } from './pipeline.js';

/**
 * LiteRT's C++ core logs its startup through Emscripten, which routes stderr to
 * console.error. DevTools then paints ordinary INFO lines red and they look like
 * crashes. LiteRT exposes no log-level option, so filter the handful of known
 * benign lines here.
 *
 * Deliberately narrow: only these exact prefixes are dropped, so a real error is
 * still shown. Hiding console output wholesale would be a bad trade.
 */
const BENIGN = [
  /^INFO: \[/,
  /^WARNING: \[npu_registry/,
  /^ERROR: Following operations are not supported by GPU delegate/,
  /^(GATHER|RESHAPE|STRIDED_SLICE):/,
  /operations will run on the GPU/,
  /Created TensorFlow Lite XNNPACK delegate/,
  /Model not fully compiled for webgpu/,
];
for (const level of ['error', 'warn', 'log']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (BENIGN.some((re) => re.test(first))) return;
    original(...args);
  };
}

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
    // Tesseract normally spawns its worker from a blob: URL that does
    // importScripts(workerPath). A blob worker has an opaque origin and cannot
    // importScripts a chrome-extension:// URL, which fails with
    // "The script at chrome-extension://.../worker.min.js failed to load".
    // Loading the worker straight from the extension URL avoids the blob entirely.
    workerBlobURL: false,
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
