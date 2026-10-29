'use client';

/**
 * Root page — redirect based on auth state.
 *
 * IMPORTANT: After a page refresh, accessToken is null for ~200ms
 * while AuthBootstrap silently calls /auth/refresh.
 * During that time we must NOT redirect to /login.
 *
 * Strategy:
 *  - If authenticated (token in memory) → go to correct dashboard by role
 *  - If not authenticated but user exists in sessionStorage → wait (AuthBootstrap is working)
 *  - If neither → go to /login
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '../store/useAuthStore';
import Spinner from '../components/ui/Spinner';
import { getLastPath } from '../lib/offlineStorage';

// Maps each role to its home dashboard route
const ROLE_DASHBOARD = {
  gm:         '/dashboard',
  supervisor: '/dashboard/supervisor',
  agent:      '/dashboard',
  finance:    '/dashboard',
  sponsor:    '/sponsor/portal',
};

// Reopen on the page the user was last on; otherwise on the role's dashboard
const startPage = (user) =>
  (user.role !== 'sponsor' && getLastPath()) || ROLE_DASHBOARD[user.role] || '/dashboard';

export default function HomePage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user        = useAuthStore((s) => s.user);

  useEffect(() => {
    if (accessToken && user) {
      // Fully authenticated — go to role-specific dashboard
      const dest = startPage(user);
      router.replace(dest);
      return;
    }

    if (!user) {
      // No session at all → public landing page
      router.replace('/landing');
      return;
    }

    // If offline and user exists, proceed to dashboard with cached data
    if (typeof navigator !== 'undefined' && !navigator.onLine && user) {
      const dest = startPage(user);
      router.replace(dest);
      return;
    }

    // Safety fallback: if 1.5s pass and still no token, proceed based on user
    const timer = setTimeout(() => {
      if (user) {
        const dest = startPage(user);
        router.replace(dest);
      } else {
        router.replace('/landing');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [accessToken, user, router]);

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-gray-50"
      dir="rtl"
    >
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" variant="primaryMuted" />
        <p className="text-sm text-gray-400 font-medium">جارٍ التحميل…</p>
      </div>
    </main>
  );
}
