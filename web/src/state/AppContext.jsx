import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import { db, getMeta, setMeta, seedIfEmpty } from '../lib/db.js';
import { api, getToken, setToken, getBaseUrl, setBaseUrl, isNative } from '../lib/api.js';
import { runSync, startAutoSync, onSync, lastSyncedAt, scheduleSync } from '../lib/sync.js';
import { newId, now } from '../../../shared/schema.js';
import { DEFAULT_BROKERAGE } from '../../../shared/tradeMath.js';
import { useLiveQuery } from 'dexie-react-hooks';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export const DEFAULT_SETTINGS = {
  brokerage: { ...DEFAULT_BROKERAGE },
  startCapital: 100000,
  currency: '₹',
  strategies: ['Breakout', 'VWAP Bounce', 'ORB', 'Short Covering', 'Gap Fill', 'Trend Pullback'],
  setups: ['15m Breakout', 'Opening Range', 'Support Bounce', 'Momentum'],
  mistakes: [
    'FOMO entry',
    'Revenge trading',
    'No stop loss',
    'Moved stop loss',
    'Over-sized',
    'Overtrading',
    'Early exit',
    'Held losing trade',
    'Ignored plan'
  ],
  emotions: ['Confident', 'Anxious', 'Greedy', 'Fearful', 'Patient', 'Frustrated', 'Disciplined', 'Bored'],
  riskPerTrade: 1,
  dailyMaxLoss: 5000,
  theme: 'dark'
};

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [localOnly, setLocalOnly] = useState(false);
  const [syncState, setSyncState] = useState({ status: 'idle' });
  const [serverUrl, setServerUrlState] = useState('');
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  const settingsRow = useLiveQuery(() => db.settings.get('app'), [], null);
  const settings = useMemo(() => ({ ...DEFAULT_SETTINGS, ...(settingsRow?.value || {}) }), [settingsRow]);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      const u = await getMeta('user', null);
      const lo = await getMeta('localOnly', false);
      const url = await getBaseUrl();
      setUser(u);
      setLocalOnly(!!lo);
      setServerUrlState(url || '');
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const off = onSync(setSyncState);
    return off;
  }, []);

  useEffect(() => {
    if (!ready) return;
    const stop = startAutoSync(30000);
    return stop;
  }, [ready]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // ---------- settings ----------
  const updateSettings = useCallback(
    async (patch) => {
      const current = await db.settings.get('app');
      const value = { ...DEFAULT_SETTINGS, ...(current?.value || {}), ...patch };
      await db.settings.put({
        id: 'app',
        user_id: 'local',
        value,
        updated_at: now(),
        deleted: 0,
        _dirty: 1
      });
      scheduleSync(1500);
    },
    []
  );

  // ---------- auth ----------
  const finishLogin = useCallback(async (data) => {
    await setToken(data.token);
    await setMeta('user', data.user);
    await setMeta('localOnly', false);
    setUser(data.user);
    setLocalOnly(false);
    runSync().catch(() => {});
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await api.login({ email, password });
      await finishLogin(data);
      return data.user;
    },
    [finishLogin]
  );

  const signup = useCallback(
    async (email, password, name) => {
      const data = await api.signup({ email, password, name });
      await finishLogin(data);
      return data.user;
    },
    [finishLogin]
  );

  const continueOffline = useCallback(async () => {
    await setMeta('localOnly', true);
    await setMeta('user', { id: 'local', name: 'Offline Trader', email: '' });
    setUser({ id: 'local', name: 'Offline Trader', email: '' });
    setLocalOnly(true);
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    await setMeta('user', null);
    await setMeta('localOnly', false);
    setUser(null);
    setLocalOnly(false);
  }, []);

  const syncNow = useCallback(() => runSync(), []);

  const saveServerUrl = useCallback(async (url) => {
    const clean = await setBaseUrl(url);
    setServerUrlState(clean);
    return clean;
  }, []);

  const value = {
    ready,
    user,
    localOnly,
    online,
    syncState,
    settings,
    updateSettings,
    login,
    signup,
    logout,
    continueOffline,
    syncNow,
    serverUrl,
    saveServerUrl,
    isNative: isNative(),
    lastSync: syncState.at || null
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
