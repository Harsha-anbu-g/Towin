// Idempotency keys for writes (the backend's IdempotencyFilter).
//
// Every POST, PUT, PATCH and DELETE carries an Idempotency-Key. The key is new for
// each fresh action, and reused only when the same write is sent again after the
// last attempt never got a successful answer: the reply was lost, the phone went
// offline, the server said "still working on it". That is the one case where the
// write may already have happened, and the reused key lets the server answer with
// the first result instead of saving it twice. Once a write succeeds its key is
// dropped, so sending "ok" twice on purpose still sends two messages.

const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete']);
// A retry after this long is treated as a new action.
const REUSE_WINDOW_MS = 10 * 60 * 1000;
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

const unanswered = new Map(); // fingerprint -> { key, at }

export function newIdempotencyKey() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

// Method, URL and body. File uploads are left alone: the server skips them too.
export function fingerprintOf(config) {
  const method = (config?.method || 'get').toLowerCase();
  if (!WRITE_METHODS.has(method)) return null;
  const data = config.data;
  if (typeof FormData !== 'undefined' && data instanceof FormData) return null;
  let body;
  try {
    body = typeof data === 'string' ? data : JSON.stringify(data ?? null);
  } catch {
    return null;
  }
  return `${method} ${config.url || ''} ${body}`;
}

export function attachIdempotencyKey(config, now = Date.now()) {
  const fingerprint = fingerprintOf(config);
  if (!fingerprint) return config;
  for (const [fp, entry] of unanswered) {
    if (now - entry.at >= REUSE_WINDOW_MS) unanswered.delete(fp);
  }
  const earlier = unanswered.get(fingerprint);
  const key = earlier ? earlier.key : newIdempotencyKey();
  unanswered.set(fingerprint, { key, at: earlier ? earlier.at : now });
  config.headers = config.headers || {};
  if (typeof config.headers.set === 'function') config.headers.set(IDEMPOTENCY_HEADER, key);
  else config.headers[IDEMPOTENCY_HEADER] = key;
  config.idempotencyFingerprint = fingerprint;
  return config;
}

// A success settles the action. Anything else keeps the key for the retry: the
// server only remembers successes, so a failed attempt simply runs again.
export function settleIdempotencyKey(config, succeeded) {
  const fingerprint = config?.idempotencyFingerprint;
  if (fingerprint && succeeded) unanswered.delete(fingerprint);
}

export function resetIdempotencyKeys() {
  unanswered.clear();
}
