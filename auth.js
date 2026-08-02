/**
 * PIN handling for Guardian's settings page.
 *
 * Deliberately free of chrome.* so it can be unit-tested in Node — the Web Crypto
 * API used here is identical in both.
 *
 * WHAT THIS DOES AND DOES NOT PROTECT
 * The PIN stops a child from casually flipping the settings off. It is NOT a
 * security boundary: chrome.storage is readable from devtools, and anyone can
 * disable the extension from chrome://extensions. What this code does guarantee is
 * that the PIN itself is never recoverable from storage — only a PBKDF2 hash is
 * kept, so the same PIN can't be lifted and reused elsewhere.
 */

const ITERATIONS = 100_000;
const HASH = 'SHA-256';
const KEY_BITS = 256;

const enc = new TextEncoder();
const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) =>
  new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));

async function derive(pin, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2',
                                            false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: HASH }, key, KEY_BITS);
  return toHex(bits);
}

/** Build the record to persist. Never contains the PIN itself. */
export async function createPinRecord(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: toHex(salt),
    hash: await derive(pin, salt),
    iterations: ITERATIONS,
    createdAt: Date.now(),
  };
}

export async function verifyPin(pin, record) {
  if (!record?.salt || !record?.hash) return false;
  const hash = await derive(pin, fromHex(record.salt), record.iterations || ITERATIONS);
  // Constant-time-ish compare: same length, no early exit on first difference.
  if (hash.length !== record.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ record.hash.charCodeAt(i);
  return diff === 0;
}

export function validatePinFormat(pin) {
  const s = String(pin ?? '');
  if (!/^\d+$/.test(s)) return 'PIN must be digits only.';
  if (s.length < 4) return 'PIN must be at least 4 digits.';
  if (s.length > 8) return 'PIN must be at most 8 digits.';
  return null;
}

/**
 * Escalating delay after wrong attempts, so guessing 0000-9999 isn't practical.
 * Persisted by the caller, so reloading the page doesn't reset the penalty.
 */
export function lockoutMs(failedAttempts) {
  if (failedAttempts < 3) return 0;
  return Math.min(2 ** (failedAttempts - 2) * 1000, 5 * 60 * 1000); // caps at 5 min
}

export function remainingLockout(state, now = Date.now()) {
  const until = (state?.lastFailedAt || 0) + lockoutMs(state?.failedAttempts || 0);
  return Math.max(0, until - now);
}
