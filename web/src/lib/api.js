import { getMeta, setMeta } from './db.js';

const ENV_API = (import.meta.env?.VITE_API_URL || '').trim().replace(/\/$/, '');

export const isNative = () =>
  typeof window !== 'undefined' &&
  typeof window.Capacitor !== 'undefined' &&
  window.Capacitor.isNativePlatform?.() === true;

/**
 * The app talks to the API in three situations:
 *  1. Dev  -> Vite proxies /api to the local server
 *  2. Web  -> same-origin /api (Express serves the built app)
 *  3. APK  -> absolute URL (set in Settings, or baked in at build time)
 */
export async function getBaseUrl() {
  const stored = await getMeta('serverUrl', null);
  if (stored && String(stored).trim()) return String(stored).trim().replace(/\/$/, '');
  if (ENV_API) return ENV_API;
  return '';
}

export async function setBaseUrl(url) {
  const clean = String(url || '').trim().replace(/\/$/, '');
  await setMeta('serverUrl', clean);
  return clean;
}

export const getDefaultBaseUrl = () => ENV_API;

export async function getToken() {
  return (await getMeta('token', null)) || null;
}
export async function setToken(token) {
  await setMeta('token', token);
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const base = await getBaseUrl();
  const url = `${base}${path}`;
  const headers = { Accept: 'application/json' };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method, headers, body: payload });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = raw ? text : { error: text?.slice(0, 200) || 'Bad response' };
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  signup: (body) => request('/api/auth/signup', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  me: () => request('/api/auth/me'),
  updateMe: (body) => request('/api/auth/me', { method: 'PATCH', body }),
  sync: (body) => request('/api/sync', { method: 'POST', body }),
  exportAll: () => request('/api/export'),
  importAll: (data) => request('/api/import', { method: 'POST', body: { data } }),
  wipe: () => request('/api/data', { method: 'DELETE' })
};
