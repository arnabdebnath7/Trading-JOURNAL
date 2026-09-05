import React, { useState } from 'react';
import { useApp } from '../state/AppContext.jsx';
import { Card, Field, Spinner } from '../components/ui.jsx';
import { TrendingUp, NotebookPen, Cloud, ShieldCheck, Smartphone } from 'lucide-react';
import { api } from '../lib/api.js';

export default function Login() {
  const { login, signup, continueOffline, serverUrl } = useApp();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await signup(email.trim(), password, name.trim());
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink-950 px-4 py-8">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-5xl items-center gap-10">
        {/* Hero */}
        <div className="hidden flex-1 md:block">
          <div className="mb-5 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-profit to-brand-600 text-base font-black text-ink-950">
              TV
            </div>
            <div>
              <div className="text-lg font-bold">TradeVault</div>
              <div className="text-[11px] uppercase tracking-widest text-slate-500">Trading + Life Journal</div>
            </div>
          </div>
          <h1 className="text-4xl font-black leading-tight text-slate-100">
            The journal that
            <br />
            <span className="bg-gradient-to-r from-profit to-brand-400 bg-clip-text text-transparent">
              fixes your trading.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-slate-400">
            Log every trade with automatic Indian brokerage &amp; charges, see exactly where your edge is, and keep a
            daily life journal that shows how your mood, sleep and habits move your P&amp;L.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-slate-300">
            {[
              ['Auto P&L & charges', 'STT, GST, stamp duty, brokerage — calculated for equity, FnO & commodity'],
              ['Real trader analytics', 'Expectancy, profit factor, R-multiple, drawdown, mistakes & emotions'],
              ['Daily life journal', 'Mood, sleep, habits, gratitude — with streaks and mood vs P&L'],
              ['Cloud sync + offline', 'Works with or without internet, on web and Android']
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-profit" />
                <span>
                  <span className="font-semibold text-slate-100">{t}.</span>{' '}
                  <span className="text-slate-500">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="w-full max-w-md">
          <Card className="p-6">
            <div className="mb-5 md:hidden">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-profit to-brand-600 text-sm font-black text-ink-950">
                  TV
                </div>
                <div className="text-base font-bold">TradeVault</div>
              </div>
              <p className="mt-2 text-[13px] text-slate-500">
                Trading journal + daily life journal, built for Indian markets.
              </p>
            </div>

            <div className="mb-4 flex rounded-xl border border-ink-700 bg-ink-900 p-1">
              {[
                ['login', 'Sign in'],
                ['signup', 'Create account']
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => {
                    setMode(v);
                    setError('');
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                    mode === v ? 'bg-brand-600 text-white' : 'text-slate-400'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === 'signup' && (
                <Field label="Your name">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul" />
                </Field>
              )}
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </Field>
              <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters' : undefined}>
                <input
                  className="input"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </Field>

              {error && (
                <div className="rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-[13px] text-loss">{error}</div>
              )}

              <button className="btn-primary w-full" disabled={busy}>
                {busy ? <Spinner size={16} /> : mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-700" />
              <span className="text-[11px] uppercase tracking-wider text-slate-600">or</span>
              <div className="h-px flex-1 bg-ink-700" />
            </div>

            <button onClick={continueOffline} className="btn-ghost w-full">
              <Smartphone size={16} /> Use on this device only
            </button>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-600">
              No account needed. Everything is saved on this device. You can sign in later from Settings to sync to the
              cloud.
            </p>

            {!serverUrl && (
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
                No server URL configured. Sign in needs a running server — set it in Settings after signing in, or use
                device-only mode.
              </p>
            )}
          </Card>

          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <Cloud size={12} /> Cloud sync
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp size={12} /> Real analytics
            </span>
            <span className="flex items-center gap-1">
              <NotebookPen size={12} /> Life journal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
