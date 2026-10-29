/**
 * offlineStorage.js — OFSMS client-side offline data cache
 *
 * Keeps the last successful answer of every GET request on the device, so the
 * app (and the Android app) can show the last known data when there is no
 * connection — also after the app was closed and opened again offline.
 *
 * - Stored in localStorage, which survives closing the app.
 * - Scoped per signed-in user, and wiped on logout, so another person using the
 *   same phone never sees the previous user's data.
 * - Size-limited: when the budget is exceeded the oldest entries are dropped.
 * - Mutations (POST / PUT / DELETE) are never cached; they are blocked while
 *   offline with a clear message (see api.js).
 */

const PREFIX = 'ofsms_oc2_';              // data entries:  ofsms_oc2_<userId>|<path>
const INDEX_KEY = 'ofsms_oc2_index';       // { [entryKey]: { t: cachedAt, n: size } }
const LEGACY_PREFIX = 'ofsms_offline_data_'; // old, not user-scoped format
const LEGACY_INDEX_KEY = 'ofsms_offline_index';

// localStorage is about 5 MB per origin: stay well below it
export const MAX_CACHE_CHARS = 3_000_000;

// ── Check if client is online ─────────────────────────────────────────────────
export function isOnline() {
  if (typeof window === 'undefined') return true;
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function currentUserId() {
  try {
    const raw = localStorage.getItem('ofsms_user');
    return raw ? JSON.parse(raw)?.id || 'anon' : 'anon';
  } catch {
    return 'anon';
  }
}

function readIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeIndex(index) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // index is rebuilt lazily; ignore
  }
}

// One-time cleanup of the old, shared (not per-user) cache format
function dropLegacyCache() {
  try {
    const raw = localStorage.getItem(LEGACY_INDEX_KEY);
    if (raw) JSON.parse(raw).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(LEGACY_INDEX_KEY);
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LEGACY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ── Normalize cache key from URL and params ───────────────────────────────────
export function getCacheKey(url, params = {}) {
  const cleanUrl = (url || '').replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0];
  const queryStr = Object.keys(params || {})
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return `${PREFIX}${currentUserId()}|${cleanUrl}${queryStr ? '?' + queryStr : ''}`;
}

// Query string written directly inside the url (axios keeps it in `url`)
function keyFor(url, params) {
  const [path, inline] = (url || '').split('?');
  if (!inline) return getCacheKey(path, params);
  const merged = { ...Object.fromEntries(new URLSearchParams(inline)), ...(params || {}) };
  return getCacheKey(path, merged);
}

// Drop the oldest entries until `needed` more characters fit
function makeRoom(index, needed) {
  const entries = Object.entries(index).sort((a, b) => a[1].t - b[1].t);
  let total = entries.reduce((sum, [, v]) => sum + v.n, 0);
  for (const [key, meta] of entries) {
    if (total + needed <= MAX_CACHE_CHARS) break;
    localStorage.removeItem(key);
    delete index[key];
    total -= meta.n;
  }
}

// ── Save data to offline cache ────────────────────────────────────────────────
export function saveOfflineData(url, params, data) {
  if (typeof window === 'undefined' || !data) return;
  try {
    if (!localStorage.getItem('ofsms_oc2_ready')) {
      dropLegacyCache();
      localStorage.setItem('ofsms_oc2_ready', '1');
    }

    const key = keyFor(url, params);
    const value = JSON.stringify({ cachedAt: Date.now(), data });
    if (value.length > MAX_CACHE_CHARS / 4) return; // a single huge answer must not push everything else out

    const index = readIndex();
    if (index[key]) delete index[key];
    makeRoom(index, value.length);

    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota exceeded although we are under budget (other data in localStorage): free more and retry once
      makeRoom(index, MAX_CACHE_CHARS);
      localStorage.setItem(key, value);
    }
    index[key] = { t: Date.now(), n: value.length };
    writeIndex(index);
  } catch (err) {
    console.warn('Offline cache write failed:', err.message);
  }
}

// ── Get data from offline cache ────────────────────────────────────────────────
export function getOfflineData(url, params) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(url, params));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── Resume where the user left off ────────────────────────────────────────────
const LAST_PATH_KEY = `${PREFIX}last_path`;

export function rememberLastPath(pathname) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_PATH_KEY, JSON.stringify({ uid: currentUserId(), path: pathname }));
  } catch {
    // ignore
  }
}

export function getLastPath() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAST_PATH_KEY);
    if (!raw) return null;
    const { uid, path } = JSON.parse(raw);
    return uid === currentUserId() && typeof path === 'string' && path.startsWith('/') ? path : null;
  } catch {
    return null;
  }
}

// ── Clear offline cache (logout / session ended) ───────────────────────────────
export function clearOfflineCache() {
  if (typeof window === 'undefined') return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    dropLegacyCache();
  } catch (err) {
    console.warn('Error clearing offline cache:', err);
  }
}
