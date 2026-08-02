// Verifies the browser tokenizer is byte-identical to Keras TextVectorization.
import { tokenize, buildVocabIndex, ruleHits, softmax } from './tokenizer.js';
import fs from 'fs';

const fx = JSON.parse(fs.readFileSync('/tmp/tok_fixture.json', 'utf8'));
const idx = buildVocabIndex(fx.vocab);
let ok = 0, bad = 0, firstBad = null;

fx.samples.forEach((raw, i) => {
  const got = Array.from(tokenize(raw, idx, fx.max_len));
  const want = fx.expected[i];
  const same = got.length === want.length && got.every((v, j) => v === want[j]);
  if (same) ok++;
  else {
    bad++;
    if (!firstBad) {
      const d = got.findIndex((v, j) => v !== want[j]);
      firstBad = { sample: i, at: d,
                   got: got.slice(Math.max(0, d - 3), d + 4),
                   want: want.slice(Math.max(0, d - 3), d + 4) };
    }
  }
});
console.log(`tokenizer: ${ok} match, ${bad} differ (of ${fx.samples.length})`);
if (firstBad) console.log('first mismatch:', JSON.stringify(firstBad));

// sanity on the small pure helpers too
const p = softmax([2, 1, 0]);
console.assert(Math.abs(p.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'softmax must sum to 1');
const h = ruleHits('Your computer is infected! Call now',
                   { malicious: ['your computer is infected'], nsfw: ['porn'] },
                   ['malicious', 'normal', 'nsfw']);
console.assert(h[0] === 1 && h[2] === 0, 'ruleHits should fire malicious only');
console.log('softmax + ruleHits: OK');
console.log(bad === 0 ? '\nTOKENIZER VERIFIED IDENTICAL TO KERAS' : '\nTOKENIZER MISMATCH');
process.exit(bad === 0 ? 0 : 1);
