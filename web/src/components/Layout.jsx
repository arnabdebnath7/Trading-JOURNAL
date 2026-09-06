import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  NotebookPen,
  Plus,
  Cloud,
  CloudOff,
  RefreshCw,
  Menu,
  Settings as SettingsIcon,
  Target,
  ListChecks,
  Eye,
  HeartPulse,
  LogOut,
  CalendarDays,
  ClipboardList
} from 'lucide-react';
import { useApp } from '../state/AppContext.jsx';
import { Toaster } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/trades', label: 'Trades', icon: BookOpen },
  { to: '/journal', label: 'Life Journal', icon: NotebookPen },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/more', label: 'More', icon: Menu }
];

const SIDEBAR_GROUPS = [
  {
    title: 'Journal',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/trades', label: 'Trades', icon: BookOpen },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/reports', label: 'Reviews', icon: ClipboardList },
      { to: '/journal', label: 'Life Journal', icon: NotebookPen }
    ]
  }
];

const MORE = [
  { to: '/calendar', label: 'P&L Calendar', icon: CalendarDays, desc: 'Month heatmap of daily P&L' },
  { to: '/reports', label: 'Reviews', icon: ClipboardList, desc: 'Weekly & monthly report cards' },
  { to: '/playbook', label: 'Playbook & Rules', icon: ListChecks, desc: 'Your setups and rules' },
  { to: '/watchlist', label: 'Watchlist', icon: Eye, desc: 'Stocks you are tracking' },
  { to: '/goals', label: 'Goals', icon: Target, desc: 'Monthly targets & limits' },
  { to: '/habits', label: 'Habits', icon: HeartPulse, desc: 'Daily life habits' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, desc: 'Account, sync, charges, backup' }
];

function SyncBadge({ compact = false }) {
  const { syncState, localOnly, syncNow, online } = useApp();
  const status = syncState.status;
  const Icon = localOnly ? CloudOff : status === 'error' ? CloudOff : status === 'syncing' ? RefreshCw : Cloud;
  const color = localOnly
    ? 'text-slate-500'
    : !online
    ? 'text-amber-400'
    : status === 'error'
    ? 'text-loss'
    : status === 'syncing'
    ? 'text-brand-400'
    : 'text-profit';
  const text = localOnly
    ? 'On this device'
    : !online
    ? 'Offline'
    : status === 'syncing'
    ? 'Syncing…'
    : status === 'error'
    ? 'Sync failed'
    : 'Synced';
  return (
    <button
      onClick={() => !localOnly && syncNow()}
      title={status === 'error' ? syncState.error : text}
      className={`flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-800 px-2.5 py-1 text-[11px] font-medium ${color}`}
    >
      <Icon size={13} className={status === 'syncing' ? 'animate-spin' : ''} />
      {!compact && text}
    </button>
  );
}

export default function Layout({ children }) {
  const [fabOpen, setFabOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useApp();

  const isMore = location.pathname.startsWith('/more');

  return (
    <div className="min-h-full bg-ink-950">
      <Toaster />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-ink-700 bg-ink-900 md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Logo />
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-100">
              TradeVault <span className="align-middle text-[9px] font-black tracking-wide text-amber-400">v2</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Trading Journal</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {SIDEBAR_GROUPS.map((g) => (
            <div key={g.title}>
              {g.title && (
                <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  {g.title}
                </div>
              )}
              {g.items.map((n) => (
                <SideLink key={n.to} {...n} />
              ))}
            </div>
          ))}
          <div className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Manage
          </div>
          {MORE.map((n) => (
            <SideLink key={n.to} {...n} />
          ))}
        </nav>
        <div className="border-t border-ink-700 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-200">{user?.name || 'Trader'}</div>
              <div className="truncate text-[11px] text-slate-500">{user?.email || 'Offline mode'}</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <SyncBadge />
            {user && !String(user.id).startsWith('local') && (
              <button onClick={logout} className="rounded-lg p-1.5 text-slate-500 hover:bg-ink-800 hover:text-loss" title="Sign out">
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <Logo small />
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-100">TradeVault</div>
            {!isMore && <div className="text-[10px] text-slate-500">{titleFor(location.pathname)}</div>}
          </div>
        </div>
        <SyncBadge compact />
      </header>

      <main className="min-h-screen pb-24 md:ml-60 md:pb-8">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-ink-700 bg-ink-900/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                  isActive ? 'text-brand-400' : 'text-slate-500'
                }`
              }
            >
              <n.icon size={20} />
              {n.label === 'Life Journal' ? 'Journal' : n.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* FAB */}
      {fabOpen && <div className="fixed inset-0 z-40 md:hidden" onClick={() => setFabOpen(false)} />}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 md:bottom-8 md:right-8">
        {fabOpen && (
          <>
            <button
              onClick={() => {
                setFabOpen(false);
                navigate('/journal/new');
              }}
              className="btn-ghost shadow-lg"
            >
              <NotebookPen size={16} /> Life entry
            </button>
            <button
              onClick={() => {
                setFabOpen(false);
                navigate('/trades/new');
              }}
              className="btn-primary shadow-lg"
            >
              <Plus size={16} /> New trade
            </button>
          </>
        )}
        <button
          onClick={() => setFabOpen((v) => !v)}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-xl transition active:scale-95"
          aria-label="Add"
        >
          <Plus size={26} className={`transition ${fabOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function SideLink({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
          isActive ? 'bg-brand-600/15 font-semibold text-brand-400' : 'text-slate-400 hover:bg-ink-800 hover:text-slate-200'
        }`
      }
    >
      <Icon size={18} />
      {label}
    </NavLink>
  );
}

function Logo({ small }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-profit to-brand-600 font-black text-ink-950 ${
        small ? 'h-8 w-8 text-[13px]' : 'h-9 w-9 text-[15px]'
      }`}
    >
      TV
    </div>
  );
}

function titleFor(path) {
  if (path.startsWith('/trades')) return 'Trade log';
  if (path.startsWith('/journal')) return 'Life journal';
  if (path.startsWith('/analytics')) return 'Performance';
  if (path.startsWith('/calendar')) return 'P&L calendar';
  if (path.startsWith('/reports')) return 'Reviews';
  if (path.startsWith('/more')) return 'More';
  return 'Overview';
}

export { MORE };
