/**
 * api.js — OFSMS Axios instance
 *
 * Access token is stored in Zustand (memory only — never localStorage).
 * Refresh token lives in httpOnly cookie managed by the backend.
 *
 * On 401: clears auth state and redirects to /login.
 */

import axios from 'axios';
import { saveOfflineData, getOfflineData, isOnline } from './offlineStorage';

// Lazy import to avoid circular deps / SSR issues
let getStore;
if (typeof window !== 'undefined') {
  // Dynamically import to avoid SSR issues with Zustand
  getStore = () => require('../store/useAuthStore').default.getState();
}

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (!process.env.NEXT_PUBLIC_API_URL && host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000/api`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
};

const api = axios.create({
  baseURL:         getApiBaseUrl(),
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true, // send httpOnly refreshToken cookie on every request
});

// ── Request interceptor: attach token & check offline mutation ───────────────
api.interceptors.request.use((config) => {
  config.baseURL = getApiBaseUrl();
  // If mutation (POST/PUT/DELETE) and client is offline, intercept immediately
  const method = (config.method || 'get').toLowerCase();
  if (method !== 'get' && typeof window !== 'undefined' && !isOnline()) {
    const offlineErr = new Error('أنت في وضع عدم الاتصال بالإنترنت. يلزم توفر اتصال بالإنترنت لإرسال أو رفع البيانات إلى قاعدة البيانات.');
    offlineErr.isOffline = true;
    return Promise.reject(offlineErr);
  }

  if (typeof window !== 'undefined' && getStore) {
    const token = getStore().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: cache GETs & fallback to cache on network error ───
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => {
    // If successful GET request, cache the response data for offline access
    const method = (res.config?.method || 'get').toLowerCase();
    const isFile = ['blob', 'arraybuffer'].includes(res.config?.responseType);
    if (method === 'get' && res.data && !isFile && typeof window !== 'undefined') {
      saveOfflineData(res.config.url || '', res.config.params, res.data);
    }
    return res;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const method = (originalRequest.method || 'get').toLowerCase();

    // ── Offline Fallback for GET requests ───────────────────────────────────
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK';
    if (method === 'get' && (isNetworkError || !isOnline()) && typeof window !== 'undefined') {
      const cached = getOfflineData(originalRequest.url || '', originalRequest.params);
      if (cached && cached.data) {
        console.info(`📦 OFSMS [Offline Mode]: Serving cached data for ${originalRequest.url}`);
        return Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: 'OK (Offline Cache)',
          headers: {},
          config: originalRequest,
          fromOfflineCache: true,
          cachedAt: cached.cachedAt,
        });
      }
    }

    // ── 401 Silent Refresh ──────────────────────────────────────────────────
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== 'undefined'
    ) {
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        // Don't retry login or refresh itself!
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/auth/refresh');
        const newToken = data.accessToken;

        if (getStore) {
          const store = getStore();
          store.setAuth(newToken, store.user);
        }

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // If offline, do NOT clear session so user can continue offline
        if (isOnline()) {
          if (getStore) getStore().clearAuth();
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
