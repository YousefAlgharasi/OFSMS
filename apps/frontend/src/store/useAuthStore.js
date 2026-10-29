/**
 * useAuthStore.js — Global auth state via Zustand
 *
 * Stores: accessToken (memory), user (localStorage)
 *
 * - accessToken lives in memory only (security — never persisted)
 * - user.role is stored in localStorage so it survives browser close/reopen
 * - On return: user is rehydrated from localStorage, then a silent
 *   /auth/refresh call restores the accessToken from the httpOnly cookie
 *
 * Flow on browser reopen:
 *   1. Zustand rehydrates user.role from localStorage
 *   2. AuthBootstrap (in layout) calls /auth/refresh → gets new accessToken
 *   3. setAuth() stores the new token in memory
 *   4. Dashboard + sidebar render normally with correct role
 */

import { create } from 'zustand';
import { clearOfflineCache } from '../lib/offlineStorage';

// ── Safely read user from localStorage (handles SSR) ─────────────────────────
const readUserFromSession = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('ofsms_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// ── Safely write user to localStorage ────────────────────────────────────────
const writeUserToSession = (user) => {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem('ofsms_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ofsms_user');
    }
  } catch {
    // localStorage quota exceeded or private mode — fail silently
  }
};

const useAuthStore = create((set, get) => ({
  accessToken: null,
  user: readUserFromSession(), // rehydrate on page load

  // Called after successful login or token refresh
  setAuth: (accessToken, user) => {
    writeUserToSession(user);
    set({ accessToken, user });
  },

  // Called on logout or unrecoverable 401
  clearAuth: () => {
    writeUserToSession(null);
    // The saved offline data belongs to the user who just left this device
    clearOfflineCache();
    set({ accessToken: null, user: null });
  },

  // True only when we have a valid in-memory access token
  isAuthenticated: () => !!get().accessToken,

  // True when we have user info (survives refresh before token is restored)
  hasUser: () => !!get().user,
}));

export default useAuthStore;
