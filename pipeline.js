/**
 * Inference pipeline: screenshot -> 5 image views + OCR text -> LiteRT -> verdict.
 *
 * Mirrors the notebook's *evaluation* path exactly (deterministic tiles, not random
 * crops), so a page classified here gets the same answer it would in Colab.
 */
import { loadLiteRt, loadAndCompile, Tensor } from '@litertjs/core';
import { tokenize as tokenizeText, buildVocabIndex, ruleHits as ruleHitsText, softmax }
  from './tokenizer.js';

const WASM_PATH = chrome.runtime.getURL('lib/litert/wasm/');
const MODEL_PATH = chrome.runtime.getURL('model/model.tflite');
const VOCAB_PATH = chrome.runtime.getURL('model/vocab.json');

let model = null;
let cfg = null;
let vocabIndex = null;

export async function init(onStatus = () => {}) {
  if (model) return cfg;

  onStatus('loading config…');
  cfg = await (await fetch(VOCAB_PATH)).json();
  vocabIndex = buildVocabIndex(cfg.vocab);

  onStatus('starting LiteRT…');
  // Load the JSPI build. Of the four glue variants LiteRT ships, only
  // litert_wasm_jspi_internal.js actually *defines* Asyncify — the plain and compat
  // builds reference it without declaring it, so the moment a model only partially
  // compiles for WebGPU and LiteRT takes its "fall back to WASM execution" path, the
  // scan dies with "Asyncify is not defined".
  try {
    await loadLiteRt(WASM_PATH, { jspi: true });
  } catch (e) {
    // loadLiteRt clears its global promise on failure, so retrying here is safe.
    console.warn('JSPI unavailable, using the default wasm build:', e);
    await loadLiteRt(WASM_PATH);
  }

  onStatus('compiling model…');
  // WebGPU when the browser offers it, otherwise CPU/wasm.
  try {
    model = await loadAndCompile(MODEL_PATH, { accelerator: 'webgpu' });
  } catch (e) {
    console.warn('WebGPU unavailable, falling back to wasm:', e);
    model = await loadAndCompile(MODEL_PATH, { accelerator: 'wasm' });
  }
  return cfg;
}

export const tokenize = (text) => tokenizeText(text, vocabIndex, cfg.max_len);

/**
 * Build the 5 views the model expects: one whole-page letterbox + four quadrants,
 * matching `fixed_tiles()` in the notebook's evaluation path.
 *
 * NOTE ON CROPPING: training screenshots included the browser address bar, which the
 * notebook cropped off (CHROME_FRAC). chrome.tabs.captureVisibleTab already excludes
 * browser chrome, so there is nothing to crop here — cropping again would cut real
 * page content and shift the input away from what the model was trained on.
 */
export async function buildViews(bitmap, debugViews = null) {
  const S = cfg.image_size;
  const views = new Float32Array(cfg.n_views * S * S * 3);
  const canvas = new OffscreenCanvas(S, S);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const writeView = (idx) => {
    if (debugViews) debugViews.push(canvas.convertToBlob().then(blobToDataUrl));
    const { data } = ctx.getImageData(0, 0, S, S);
    let o = idx * S * S * 3;
    for (let p = 0; p < data.length; p += 4) {
      views[o++] = data[p];       // model does its own preprocess_input,
      views[o++] = data[p + 1];   // so feed raw 0-255
      views[o++] = data[p + 2];
    }
  };

  // view 0 — whole page, aspect preserved with padding (resize_with_pad)
  const scale = Math.min(S / bitmap.width, S / bitmap.height);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, S, S);
  ctx.drawImage(bitmap, (S - w) / 2, (S - h) / 2, w, h);
  writeView(0);

  // views 1..4 — quadrants at native resolution, each stretched to SxS
  const hw = Math.floor(bitmap.width / 2);
  const hh = Math.floor(bitmap.height / 2);
  const quads = [
    [0, 0], [hw, 0], [0, hh], [hw, hh],
  ];
  for (let i = 0; i < cfg.k_crops; i++) {
    const [sx, sy] = quads[i % 4];
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(bitmap, sx, sy, hw, hh, 0, 0, S, S);
    writeView(i + 1);
  }
  return views;
}

export const ruleHits = (text) => ruleHitsText(text, cfg.rule_phrases, cfg.class_names);

/** A risky class wins if it clears its own bar, rather than having to win argmax. */
function decide(probs, opts = {}) {
  const names = cfg.class_names;
  const iN = names.indexOf('nsfw');
  const iM = names.indexOf('malicious');
  const th = cfg.thresholds || {};
  const tN = opts.nsfwThreshold != null ? opts.nsfwThreshold : th.nsfw;
  const tM = opts.maliciousThreshold != null ? opts.maliciousThreshold : th.malicious;
  let best = probs.indexOf(Math.max(...probs));
  if (tM != null && probs[iM] >= tM) best = iM;
  if (tN != null && probs[iN] >= tN) best = iN;   // nsfw last: the safest class wins ties
  return best;
}

/**
 * Full pipeline. `bitmap` is the page screenshot, `ocrText` from Tesseract.
 *
 * `opts` lets the caller override the decision rule baked into vocab.json. The
 * tuned values maximise macro-F1 on the evaluation set, where a keyword rule adds
 * nothing because the model has already seen the vocabulary. In the browser the
 * rules matter: they are the only thing that still fires when the visual branch is
 * confident and wrong, which is exactly the reported failure on a search results
 * page whose text plainly says what it is.
 */
const blobToDataUrl = (blob) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsDataURL(blob);
});

export async function classify(bitmap, ocrText, opts = {}) {
  const debugViews = opts.debug ? [] : null;
  const t = [performance.now()];
  const views = await buildViews(bitmap, debugViews);
  t.push(performance.now());
  const tokens = tokenize(ocrText);

  const viewsT = Tensor.fromTypedArray(views, [1, cfg.n_views, cfg.image_size, cfg.image_size, 3]);
  const textT = Tensor.fromTypedArray(tokens, [1, cfg.max_len]);

  const outputs = await model.run({ views: viewsT, text: textT });
  t.push(performance.now());
  const key = Object.keys(outputs)[0];
  const logits = Array.from(await outputs[key].data()); // model emits FUSED LOGITS
  t.push(performance.now());

  // rules are added in logit space, exactly as the notebook's search did
  const boost = opts.ruleBoost != null ? opts.ruleBoost : (cfg.rule_boost || 0);
  const rules = ruleHits(ocrText);
  const fused = logits.map((v, i) => v + boost * rules[i]);
  const probs = softmax(fused);

  viewsT.delete();
  textT.delete();
  Object.values(outputs).forEach((t) => t.delete());

  const idx = decide(probs, opts);
  const label = cfg.class_names[idx];
  const top = Math.max(...probs);
  return {
    label,
    probs: Object.fromEntries(cfg.class_names.map((c, i) => [c, probs[i]])),
    ocrChars: (ocrText || '').length,
    ruleFired: rules.some((v) => v > 0),
    // Low confidence, or a flagged page, is what triggers a confirmation scan.
    uncertain: top < 0.65,
    // our own "checking this page" pill in the OCR means the capture caught the blur
    blurred: /checking this page/i.test(ocrText || ''),
    // exactly what the model saw, for the service worker's console
    // where the "model" time goes: preprocessing, inference, GPU readback
    split: { views: t[1] - t[0], run: t[2] - t[1], readback: t[3] - t[2] },
    debug: debugViews ? {
      size: [bitmap.width, bitmap.height],
      views: await Promise.all(debugViews),
      logits, rules, ocrText: ocrText || '',
    } : undefined,
  };
}
