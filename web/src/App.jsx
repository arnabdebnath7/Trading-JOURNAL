import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useApp } from './state/AppContext.jsx';
import { Spinner } from './components/ui.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Trades from './pages/Trades.jsx';
import TradeEditor from './pages/TradeEditor.jsx';
import Analytics from './pages/Analytics.jsx';
import Journal from './pages/Journal.jsx';
import JournalEntry from './pages/JournalEntry.jsx';
import Playbook from './pages/Playbook.jsx';
import Watchlist from './pages/Watchlist.jsx';
import Goals from './pages/Goals.jsx';
import Habits from './pages/Habits.jsx';
import Settings from './pages/Settings.jsx';
import More from './pages/More.jsx';

export default function App() {
  const { ready, user } = useApp();

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={26} className="text-brand-400" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/trades" element={<Trades />} />
        <Route path="/trades/new" element={<TradeEditor />} />
        <Route path="/trades/:id" element={<TradeEditor />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/journal/new" element={<JournalEntry />} />
        <Route path="/journal/:date" element={<JournalEntry />} />
        <Route path="/playbook" element={<Playbook />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/more" element={<More />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
