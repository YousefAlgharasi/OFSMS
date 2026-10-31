/**
 * useSponsorStore.js
 * Zustand store for sponsor portal auth — completely separate from the
 * main useAuthStore used by internal staff.
 *
 * The token is kept in sessionStorage (this tab only, gone when the tab closes), so a page
 * reload does not log the sponsor out. Never localStorage.
 * Sponsor logs in via portal_token + password.
 */

import { create } from 'zustand';

const KEY = 'ofsms_sponsor_session';

const load = () => {
  if (typeof window === 'undefined') return { accessToken: null, sponsor: null };
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { accessToken: null, sponsor: null };
  } catch {
    return { accessToken: null, sponsor: null };
  }
};
const save = (value) => {
  try {
    if (value) window.sessionStorage.setItem(KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
};

const useSponsorStore = create((set, get) => ({
  ...load(),

  setSponsorAuth: (accessToken, sponsor) => { save({ accessToken, sponsor }); set({ accessToken, sponsor }); },
  clearSponsorAuth: () => { save(null); set({ accessToken: null, sponsor: null }); },
  isAuthenticated: () => !!get().accessToken,
}));

export default useSponsorStore;
