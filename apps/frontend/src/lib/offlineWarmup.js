/**
 * offlineWarmup.js — save the app's pages on the device while online
 *
 * The service worker only keeps pages that were opened. After login this goes
 * through the menu pages of the user's role once, in the background, so that
 * every one of them also opens with no connection.
 */

const WARM_KEY = 'ofsms_oc2_warm';
const WARM_EVERY_MS = 6 * 60 * 60 * 1000; // refresh the saved pages every 6 hours
const MAX_PARALLEL = 3;

// Chunk files a page needs: "/_next/static/…" or the relative "static/chunks/…" form
const ASSET_RE = /(?:\/_next\/)?static\/(?:chunks|media|css)\/[A-Za-z0-9_~.-]+\.(?:js|css|woff2?)(?:\?[A-Za-z0-9_=&;.-]+)?/g;

function waitForController(timeoutMs) {
  if (navigator.serviceWorker.controller) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok) => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      clearTimeout(timer);
      resolve(ok);
    };
    const onChange = () => done(true);
    const timer = setTimeout(() => done(!!navigator.serviceWorker.controller), timeoutMs);
    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        try { await fn(item); } catch { /* keep going: one failing page must not stop the rest */ }
      }
    })
  );
}

export async function warmOfflineCache(role, hrefs) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.onLine) return;

  try {
    const last = JSON.parse(localStorage.getItem(WARM_KEY) || 'null');
    if (last && last.role === role && Date.now() - last.t < WARM_EVERY_MS) return;
  } catch { /* ignore */ }

  if (!(await waitForController(15000))) return; // no service worker (e.g. development)

  const paths = [...new Set(hrefs.filter((h) => h && !h.includes('[')))];
  const assets = new Set();

  await mapLimit(paths, MAX_PARALLEL, async (path) => {
    const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
    if (!res.ok) return;
    const html = (await res.text()).replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    for (const m of html.matchAll(ASSET_RE)) {
      assets.add(m[0].startsWith('/_next/') ? m[0] : `/_next/${m[0]}`);
    }
  });

  await mapLimit([...assets], MAX_PARALLEL * 2, (asset) => fetch(asset, { credentials: 'same-origin' }));

  try {
    localStorage.setItem(WARM_KEY, JSON.stringify({ role, t: Date.now() }));
  } catch { /* ignore */ }
}
