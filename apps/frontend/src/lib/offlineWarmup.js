/**
 * offlineWarmup.js — save the app on the device while online
 *
 * Right after login (and then at most once an hour) this goes through
 *   1. the pages of the user's role (and the files each page needs), and
 *   2. the data those pages show (lists, details, dashboards),
 * so everything opens with no connection — also after the app was closed.
 * Normal use keeps the saved copies fresh: every page that is opened or
 * refreshed online replaces its saved page and data.
 */

import api from './api';

const WARM_KEY = 'ofsms_oc2_warm';
const WARM_EVERY_MS = 60 * 60 * 1000; // at most once an hour
const MAX_PARALLEL = 3;
const MAX_DETAILS = 60;               // orphan / family detail pages saved per type

// Chunk files a page needs: "/_next/static/…" or the relative "static/chunks/…" form
const ASSET_RE = /(?:\/_next\/)?static\/(?:chunks|media|css)\/[A-Za-z0-9_~.-]+\.(?:js|css|woff2?)(?:\?[A-Za-z0-9_=&;.-]+)?/g;

// Data every role reads
const COMMON_DATA = [
  '/governorates',
  '/notifications?limit=20',
  '/announcements',
  '/in-kind/programs',
  '/in-kind/types',
  '/educational/programs',
  '/educational/templates',
  '/educational/categories',
  // [url, params] — same call as the evaluations page makes
  ['/evaluations/beneficiaries', { type: 'orphan', search: '' }],
  ['/evaluations/beneficiaries', { type: 'family', search: '' }],
];

const DATA_BY_ROLE = {
  agent: [
    '/dashboard/agent', '/orphans', '/orphans?status=under_sponsorship', '/families',
    '/quran-reports/mine', '/disbursements/agent/released',
  ],
  supervisor: [
    '/dashboard/supervisor', '/orphans', '/families',
    '/supervisor/queue', '/quran-reports/pending?status=all', '/quran-thresholds', '/disbursements', '/disbursements/history',
  ],
  gm: [
    '/dashboard/gm', '/orphans', '/families', '/orphans/marketing', '/families/marketing', '/orphans/gifted',
    '/sponsors', '/users', '/supervisor/queue', '/quran-reports/pending?status=all', '/quran-thresholds',
    '/disbursements', '/disbursements/history', '/ads', '/settings', '/landing',
  ],
  finance: ['/dashboard/finance', '/disbursements', '/disbursements/history'],
};

// ── Progress (read by <OfflineReadyChip />) ────────────────────────────────────
let status = { state: 'idle', done: 0, total: 0 };
const listeners = new Set();

function setStatus(next) {
  status = { ...status, ...next };
  listeners.forEach((fn) => fn());
}

export const subscribeWarmStatus = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getWarmStatus = () => status;

// ── Helpers ────────────────────────────────────────────────────────────────────
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
        try { await fn(item); } catch { /* keep going: one failing item must not stop the rest */ }
      }
    })
  );
}

const tick = () => setStatus({ done: status.done + 1 });

// GET through the app's api client, which saves the answer in the offline data cache
async function warmData(entry) {
  const [url, params] = Array.isArray(entry) ? entry : [entry, undefined];
  try {
    const { data } = await api.get(url, params ? { params } : undefined);
    return data;
  } catch {
    return null; // role may not be allowed to read it, or the server is busy: skip
  } finally {
    tick();
  }
}

async function warmPage(path, assets) {
  try {
    const res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
    if (!res.ok) return;
    const html = (await res.text()).replace(/&amp;/g, '&').replace(/\\u0026/g, '&').replace(/\\\//g, '/');
    for (const m of html.matchAll(ASSET_RE)) {
      assets.add(m[0].startsWith('/_next/') ? m[0] : `/_next/${m[0]}`);
    }
  } finally {
    tick();
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
export async function warmOfflineCache(role, routes) {
  if (typeof window === 'undefined' || !navigator.onLine || status.state === 'running') return;

  if (!('serviceWorker' in navigator)) {
    setStatus({ state: 'unsupported' });
    return;
  }

  try {
    const last = JSON.parse(localStorage.getItem(WARM_KEY) || 'null');
    if (last && last.role === role && Date.now() - last.t < WARM_EVERY_MS) {
      setStatus({ state: 'ready' });
      return;
    }
  } catch { /* ignore */ }

  if (!(await waitForController(15000))) {
    setStatus({ state: 'unsupported' }); // no service worker controls this page (not installed / blocked)
    return;
  }

  const pages = [...new Set(routes.filter((r) => r && !r.includes('[')))];
  const dataUrls = [...COMMON_DATA, ...(DATA_BY_ROLE[role] || [])];
  setStatus({ state: 'running', done: 0, total: pages.length + dataUrls.length });

  try {
    // 1. Data first (it also tells us which detail pages exist)
    const results = {};
    await mapLimit(dataUrls, MAX_PARALLEL, async (entry) => {
      results[Array.isArray(entry) ? entry[0] : entry] = await warmData(entry);
    });

    const orphanIds = (results['/orphans']?.orphans || []).slice(0, MAX_DETAILS).map((o) => o.id);
    const familyIds = (results['/families']?.families || []).slice(0, MAX_DETAILS).map((f) => f.id);
    const releasedLists = (results['/disbursements/agent/released']?.lists || []).slice(0, 6).map((l) => l.id);
    const disbursementLists = (results['/disbursements']?.lists || results['/disbursements']?.disbursements || [])
      .slice(0, 3).map((l) => l.id);

    const extraData = [
      ...orphanIds.map((id) => `/orphans/${id}`),
      ...familyIds.map((id) => `/families/${id}`),
      ...releasedLists.flatMap((id) => [`/receipts/my-items/${id}`, `/receipts/summary/${id}`]),
      ...disbursementLists.flatMap((id) => [`/disbursements/${id}`, `/receipts/supervisor-log/${id}`]),
    ];
    const detailPages = [...orphanIds.map((id) => `/orphans/${id}`), ...familyIds.map((id) => `/families/${id}`)];
    setStatus({ total: status.total + extraData.length + detailPages.length });

    await mapLimit(extraData, MAX_PARALLEL, warmData);

    // 2. Pages and the files they need
    const assets = new Set();
    await mapLimit([...pages, ...detailPages], MAX_PARALLEL, (path) => warmPage(path, assets));

    setStatus({ total: status.total + assets.size });
    await mapLimit([...assets], MAX_PARALLEL * 2, async (asset) => {
      try { await fetch(asset, { credentials: 'same-origin' }); } finally { tick(); }
    });

    try {
      localStorage.setItem(WARM_KEY, JSON.stringify({ role, t: Date.now() }));
    } catch { /* ignore */ }
    setStatus({ state: 'ready' });
  } catch {
    setStatus({ state: 'error' });
  }
}
