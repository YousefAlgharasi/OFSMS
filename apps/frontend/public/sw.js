/**
 * sw.js — OFSMS Service Worker (offline support)
 *
 * Goal: after the app was opened once online it can be opened again with no
 * connection (also from the Android app), showing the last saved pages and data.
 *
 *  - /_next/static/* and images/fonts → cache-first (file names are hashed, so they never change)
 *  - pages (HTML)                     → network-first with a short timeout, saved by path
 *  - Next.js page data (RSC)          → network-first, saved, so in-app navigation keeps working
 *  - API data is cached by the app itself (lib/offlineStorage.js), not here
 */

const VERSION = 'v3';
const STATIC_CACHE = `ofsms-static-${VERSION}`;
const PAGE_CACHE = `ofsms-pages-${VERSION}`;
const OFFLINE_URL = '/offline.html';

// With a saved copy at hand, give up on a slow network after this long
const NETWORK_TIMEOUT_MS = 4000;

const PRECACHE = [OFFLINE_URL, '/', '/login', '/landing', '/dashboard', '/manifest.json', '/logo.png', '/ikram-logo.png', '/favicon.ico'];

// Script / style files a page needs: "/_next/static/…" or the relative "static/chunks/…" form
const ASSET_RE = /(?:\/_next\/)?static\/(?:chunks|media|css)\/[A-Za-z0-9_~.-]+\.(?:js|css|woff2?)(?:\?[A-Za-z0-9_=&;.-]+)?/g;

// Save every file the given page needs, so the page itself also opens offline
async function cacheAssetsOf(response) {
  try {
    const html = (await response.text()).replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    const urls = new Set();
    for (const m of html.matchAll(ASSET_RE)) urls.add(m[0].startsWith('/_next/') ? m[0] : `/_next/${m[0]}`);
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(
      [...urls].map(async (u) => {
        if (await cache.match(u)) return;
        try {
          const res = await fetch(u, { credentials: 'same-origin' });
          if (res.status === 200) await cache.put(u, res);
        } catch { /* skip */ }
      })
    );
  } catch { /* skip */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGE_CACHE);
      // One failing file must not break the install
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { credentials: 'same-origin' }));
            if (res.status !== 200) return;
            await pages.put(new Request(new URL(url, self.location.origin).href), res.clone());
            if ((res.headers.get('content-type') || '').includes('text/html')) await cacheAssetsOf(res);
          } catch { /* skip */ }
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = [STATIC_CACHE, PAGE_CACHE];
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('ofsms-') && !keep.includes(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  /\.(png|jpe?g|svg|webp|ico|woff2?|ttf|css)$/i.test(url.pathname);

const isPageData = (request, url) => request.headers.get('RSC') === '1' || url.searchParams.has('_rsc');

const isHtmlRequest = (request) =>
  request.mode === 'navigate' || (request.headers.get('Accept') || '').includes('text/html');

// Pages are saved by path (ignoring ?query and #hash)
const pageKey = (url) => new Request(url.origin + url.pathname);

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request, url, event) {
  const cache = await caches.open(PAGE_CACHE);
  const key = pageKey(url);
  const cached = await cache.match(key);
  try {
    const network = fetch(request);
    const response = cached ? await withTimeout(network, NETWORK_TIMEOUT_MS) : await network;
    // Only real pages are kept (not redirects or error pages)
    if (response && response.status === 200 && response.type !== 'opaqueredirect') {
      cache.put(key, response.clone());
      // Keep the files this page needs as well (so it also opens offline)
      event.waitUntil(cacheAssetsOf(response.clone()));
    }
    return response;
  } catch {
    if (cached) return cached;
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

async function networkFirstData(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const cached = await cache.match(request);
    const network = fetch(request);
    const response = cached ? await withTimeout(network, NETWORK_TIMEOUT_MS) : await network;
    if (response && response.status === 200) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;       // API (other host) is handled by the app
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js') return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isPageData(request, url)) {
    event.respondWith(networkFirstData(request));
  } else if (isHtmlRequest(request)) {
    event.respondWith(networkFirstPage(request, url, event));
  }
});
