/**
 * Text handling, kept free of chrome/LiteRT imports so it can be unit-tested in Node
 * against the Python side. This must match Keras TextVectorization exactly, or the
 * text branch silently receives nonsense.
 *
 * TextVectorization defaults used at training time:
 *   standardize = "lower_and_strip_punctuation", split = "whitespace"
 *   index 0 = padding, index 1 = [UNK]
 */

// Keras strips this exact set (python string.punctuation).
const PUNCT = /[!"#$%&()*+,\-./:;<=>?@[\\\]^_`{|}~']/g;

// Same URL scrubbing the notebook applies before the model sees the text, so the
// model can't lean on the address bar.
const URLISH =
  /(?:https?:\/\/)?\S*\.\S*\/\S*|\b(?:[a-z0-9][a-z0-9-]{1,40}\.)+(?:com|net|org|tv|xxx|io|co|me|ru|info|site|online|club|to|cc|app|sbs|best|top|xyz|shop|dev|gov|edu)\b/gi;

export function stripUrls(text) {
  return String(text || '').replace(URLISH, ' ');
}

export function standardize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(PUNCT, '')
    .split(/\s+/)
    .filter(Boolean);
}

/** @param {Map<string,number>} vocabIndex @returns {Int32Array} padded token ids */
export function tokenize(text, vocabIndex, maxLen) {
  const words = standardize(stripUrls(text));
  const ids = new Int32Array(maxLen); // zeros = pad token
  for (let i = 0; i < Math.min(words.length, maxLen); i++) {
    const v = vocabIndex.get(words[i]);
    ids[i] = v === undefined ? 1 : v; // 1 = [UNK]
  }
  return ids;
}

export function buildVocabIndex(vocab) {
  return new Map(vocab.map((tok, i) => [tok, i]));
}

/** Which class's high-precision phrases fired. Mirrors rule_matrix() in the notebook. */
export function ruleHits(text, rulePhrases, classNames) {
  const t = String(text || '').toLowerCase();
  const hits = new Float32Array(classNames.length);
  for (const [cls, phrases] of Object.entries(rulePhrases || {})) {
    const i = classNames.indexOf(cls);
    if (i >= 0 && phrases.some((p) => t.includes(p))) hits[i] = 1;
  }
  return hits;
}

export function softmax(z) {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
