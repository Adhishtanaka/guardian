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
  await loadLiteRt(WASM_PATH);

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
export async function buildViews(bitmap) {
  const S = cfg.image_size;
  const views = new Float32Array(cfg.n_views * S * S * 3);
  const canvas = new OffscreenCanvas(S, S);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const writeView = (idx) => {
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

/** Threshold rule from the notebook: a risky class wins if it clears its own bar. */
function decide(probs) {
  const names = cfg.class_names;
  const iN = names.indexOf('nsfw');
  const iM = names.indexOf('malicious');
  const th = cfg.thresholds || {};
  let best = probs.indexOf(Math.max(...probs));
  if (th.malicious != null && probs[iM] >= th.malicious) best = iM;
  if (th.nsfw != null && probs[iN] >= th.nsfw) best = iN; // nsfw last: safest wins ties
  return best;
}

/** Full pipeline. `bitmap` is the page screenshot, `ocrText` from Tesseract. */
export async function classify(bitmap, ocrText) {
  const views = await buildViews(bitmap);
  const tokens = tokenize(ocrText);

  const viewsT = Tensor.fromTypedArray(views, [1, cfg.n_views, cfg.image_size, cfg.image_size, 3]);
  const textT = Tensor.fromTypedArray(tokens, [1, cfg.max_len]);

  const outputs = await model.run({ views: viewsT, text: textT });
  const key = Object.keys(outputs)[0];
  const logits = Array.from(await outputs[key].data()); // model emits FUSED LOGITS

  // rules are added in logit space, exactly as the notebook's search did
  const boost = cfg.rule_boost || 0;
  const rules = ruleHits(ocrText);
  const fused = logits.map((v, i) => v + boost * rules[i]);
  const probs = softmax(fused);

  viewsT.delete();
  textT.delete();
  Object.values(outputs).forEach((t) => t.delete());

  const idx = decide(probs);
  return {
    label: cfg.class_names[idx],
    probs: Object.fromEntries(cfg.class_names.map((c, i) => [c, probs[i]])),
    ocrChars: (ocrText || '').length,
  };
}
