import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { api, getDefaultBaseUrl, setToken } from '../lib/api.js';
import { db, factoryReset, setMeta } from '../lib/db.js';
import { scheduleSync, runSync } from '../lib/sync.js';
import { Card, SectionTitle, Field, Switch, TagInput, Confirm, Spinner } from '../components/ui.jsx';
import { useTrades, useEntries } from '../lib/hooks.js';
import { TABLES } from '../../../shared/schema.js';
import { Cloud, CloudOff, RefreshCw, Download, Upload, Trash2, LogIn, LogOut, Check } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, user, localOnly, syncState, syncNow, logout, serverUrl, saveServerUrl } = useApp();
  const trades = useTrades();
  const entries = useEntries();
  const fileRef = useRef(null);

  const [url, setUrl] = useState(serverUrl || '');
  const [testState, setTestState] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => setUrl(serverUrl || ''), [serverUrl]);

  const testConnection = async () => {
    setTestState('testing');
    try {
      await saveServerUrl(url);
      const h = await api.health();
      setTestState(h?.ok ? 'ok' : 'fail');
    } catch (e) {
      setTestState('fail');
    }
  };

  const doAuth = async () => {
    setBusy(true);
    setAuthError('');
    try {
      const fn = mode === 'login' ? api.login : api.signup;
      const data = await fn({ email: email.trim(), password });
      await setToken(data.token);
      await setMeta('user', data.user);
      await setMeta('localOnly', false);
      setMsg('Signed in. Syncing your data…');
      await runSync();
      setMsg('Signed in and synced.');
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setAuthError(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const exportJson = async () => {
    const data = {};
    for (const t of TABLES) data[t] = await db[t].toArray();
    const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tradevault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed;
    for (const t of TABLES) {
      if (!Array.isArray(data[t])) continue;
      for (const row of data[t]) {
        if (!row?.id) continue;
        await db[t].put({ ...row, _dirty: 1 });
      }
    }
    scheduleSync(300);
    setMsg('Backup restored. Syncing…');
  };

  const wipe = async () => {
    await factoryReset();
    window.location.reload();
  };

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-[13px] text-slate-500">
          {trades.length} trades · {entries.length} journal entries
        </p>
      </div>

      {msg && <div className="rounded-xl border border-profit/30 bg-profit/10 px-3 py-2 text-[13px] text-profit">{msg}</div>}

      {/* Account & sync */}
      <Card className="space-y-3">
        <SectionTitle>Account &amp; sync</SectionTitle>
        <div className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            {localOnly ? <CloudOff size={18} className="text-slate-500" /> : <Cloud size={18} className="text-profit" />}
            <div>
              <div className="text-[13px] font-semibold text-slate-100">
                {localOnly ? 'Device only' : user?.email || user?.name || 'Signed in'}
              </div>
              <div className="text-[11px] text-slate-500">
                {localOnly
                  ? 'Data stays on this device'
                  : `Last sync: ${syncState.at ? new Date(syncState.at).toLocaleTimeString('en-IN') : 'pending'}`}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!localOnly && (
              <button className="btn-ghost btn-sm" onClick={syncNow}>
                <RefreshCw size={14} className={syncState.status === 'syncing' ? 'animate-spin' : ''} />
                Sync
              </button>
            )}
            {!localOnly && user && !String(user.id).startsWith('local') && (
              <button className="btn-ghost btn-sm" onClick={logout}>
                <LogOut size={14} /> Sign out
              </button>
            )}
          </div>
        </div>

        {localOnly && (
          <div className="space-y-2 rounded-xl border border-ink-700 bg-ink-900 p-3">
            <p className="text-[12px] text-slate-400">
              Sign in to back up your journal to the cloud and use it on all your devices.
            </p>
            <div className="flex gap-1.5">
              {['login', 'signup'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
                    mode === m ? 'bg-brand-600 text-white' : 'bg-ink-800 text-slate-400'
                  }`}
                >
                  {m === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
            <input
              className="input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {authError && <div className="text-[12px] text-loss">{authError}</div>}
            <button className="btn-primary btn-sm w-full" onClick={doAuth} disabled={busy}>
              {busy ? <Spinner size={14} /> : <LogIn size={14} />} {mode === 'login' ? 'Sign in & sync' : 'Create account'}
            </button>
          </div>
        )}

        <Field label="Server URL" hint="Leave empty to use the same site this app is served from.">
          <div className="flex gap-2">
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={getDefaultBaseUrl() || 'https://your-server.com'}
            />
            <button className="btn-ghost shrink-0" onClick={testConnection}>
              {testState === 'testing' ? <Spinner size={14} /> : testState === 'ok' ? <Check size={14} className="text-profit" /> : 'Test'}
            </button>
          </div>
        </Field>
        {testState === 'fail' && (
          <p className="text-[12px] text-loss">
            Could not reach the server. Check the URL — it must be reachable from this device.
          </p>
        )}
      </Card>

      {/* Trading defaults */}
      <Card className="space-y-3">
        <SectionTitle>Trading defaults</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Starting capital (₹)">
            <input
              className="input tabular"
              type="number"
              value={settings.startCapital}
              onChange={(e) => updateSettings({ startCapital: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Risk per trade (%)">
            <input
              className="input tabular"
              type="number"
              step="0.1"
              value={settings.riskPerTrade}
              onChange={(e) => updateSettings({ riskPerTrade: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Brokerage per order (₹)">
            <input
              className="input tabular"
              type="number"
              step="0.5"
              value={settings.brokerage?.flatPerOrder ?? 20}
              onChange={(e) =>
                updateSettings({ brokerage: { ...settings.brokerage, flatPerOrder: Number(e.target.value) || 0 } })
              }
            />
          </Field>
          <Field label="Brokerage % (0.03 = 0.03%)">
            <input
              className="input tabular"
              type="number"
              step="0.0001"
              value={(settings.brokerage?.pct ?? 0.0003) * 100}
              onChange={(e) =>
                updateSettings({ brokerage: { ...settings.brokerage, pct: (Number(e.target.value) || 0) / 100 } })
              }
            />
          </Field>
        </div>
        <Switch
          checked={settings.brokerage?.autoCharges !== false}
          onChange={(v) => updateSettings({ brokerage: { ...settings.brokerage, autoCharges: v } })}
          label="Auto-calculate charges"
        />
        <Switch
          checked={settings.brokerage?.gstOnBrokerage !== false}
          onChange={(v) => updateSettings({ brokerage: { ...settings.brokerage, gstOnBrokerage: v } })}
          label="Include 18% GST on charges"
        />
        <p className="text-[11px] leading-relaxed text-slate-600">
          Standard NSE rates are used for STT, exchange transaction charges, SEBI turnover fees and stamp duty for
          equity intraday, equity delivery, futures, options and commodity. Brokerage is configurable above.
        </p>
      </Card>

      {/* Lists */}
      <Card className="space-y-4">
        <SectionTitle>Your lists</SectionTitle>
        <Field label="Strategies">
          <TagInput
            values={settings.strategies || []}
            onChange={(v) => updateSettings({ strategies: v })}
            placeholder="strategy"
          />
        </Field>
        <Field label="Setups">
          <TagInput values={settings.setups || []} onChange={(v) => updateSettings({ setups: v })} placeholder="setup" />
        </Field>
        <Field label="Mistakes">
          <TagInput
            values={settings.mistakes || []}
            onChange={(v) => updateSettings({ mistakes: v })}
            placeholder="mistake"
          />
        </Field>
        <Field label="Emotions">
          <TagInput
            values={settings.emotions || []}
            onChange={(v) => updateSettings({ emotions: v })}
            placeholder="emotion"
          />
        </Field>
      </Card>

      {/* Data */}
      <Card className="space-y-3">
        <SectionTitle>Backup &amp; data</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn-ghost" onClick={exportJson}>
            <Download size={15} /> Export backup (JSON)
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Restore from backup
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await importJson(f);
            e.target.value = '';
          }}
        />
        <p className="text-[11px] text-slate-600">
          The backup contains every trade, journal entry, habit and setting. Keep it safe — it is the fastest way to
          move your data to another device.
        </p>
        <button className="btn-danger w-full" onClick={() => setConfirmWipe(true)}>
          <Trash2 size={15} /> Erase all data on this device
        </button>
      </Card>

      <Card>
        <SectionTitle>About</SectionTitle>
        <div className="space-y-1 text-[13px] text-slate-400">
          <p>
            <b className="text-slate-200">TradeVault</b> v1.0 — a trading journal and daily life journal for Indian
            markets.
          </p>
          <p className="text-[12px] text-slate-600">
            Tip: on your phone browser use “Add to Home screen” to install it like an app.
          </p>
        </div>
      </Card>

      <Confirm
        open={confirmWipe}
        title="Erase everything?"
        body="All trades, journal entries, habits and settings on this device will be deleted. Your cloud copy stays until the next sync — which will also be erased."
        confirmText="Erase everything"
        onCancel={() => setConfirmWipe(false)}
        onConfirm={wipe}
      />
    </div>
  );
}
