'use client';

/**
 * OfflineBanner.jsx — OFSMS Offline Status
 *
 * 1. Monitors network connection state (online/offline).
 * 2. Displays a sleek floating status banner when offline informing the user
 *    that cached reports and data remain accessible, and mutations require internet.
 * 3. Shows a success banner when back online.
 * 4. Automatically registers the Service Worker for offline asset caching.
 */

import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial check
    setIsOffline(!navigator.onLine);

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 4000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Register Service Worker for offline PWA (production only; in dev a stale
    // worker serves old JS and hides new UI, so remove any existing one)
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('✅ OFSMS Service Worker registered:', reg.scope))
          .catch((err) => console.warn('Service Worker registration failed:', err));
      } else {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
        if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <>
      {/* ── Offline Floating Alert ─────────────────────────────────────────── */}
      {isOffline && (
        <div
          dir="rtl"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-xl border border-amber-600 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <WifiOff className="w-4 h-4 text-slate-950 shrink-0" />
          <span>أنت في وضع عدم الاتصال (Offline) — تصفح التقارير والبيانات المحفوظة متاح</span>
        </div>
      )}

      {/* ── Reconnected Success Alert ──────────────────────────────────────── */}
      {showReconnected && (
        <div
          dir="rtl"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B5E8C] text-white font-bold text-xs shadow-xl border border-blue-400 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <Wifi className="w-4 h-4 text-white shrink-0" />
          <span>تم استعادة الاتصال بالإنترنت بنجاح</span>
        </div>
      )}

    </>
  );
}
