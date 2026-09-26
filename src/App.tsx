import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useStore, useActiveTour } from './store';
import { bridge } from './lib/bridge';
import TourSwitcher from './components/TourSwitcher';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Advancing from './pages/Advancing';
import Directory from './pages/Directory';
import Budget from './pages/Budget';
import Documents from './pages/Documents';
import Chat from './pages/Chat';
import SettingsPage from './pages/Settings';

const NAV = [
  { to: '/dashboard', label: 'Overview', icon: '◎' },
  { to: '/schedule', label: 'Schedule', icon: '▦' },
  { to: '/advancing', label: 'Advancing', icon: '✓' },
  { to: '/directory', label: 'Directory', icon: '☏' },
  { to: '/budget', label: 'Budget', icon: '$' },
  { to: '/documents', label: 'Docs & Reports', icon: '▤' },
  { to: '/chat', label: 'Chat', icon: '✉' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  const data = useStore((s) => s.data);
  const load = useStore((s) => s.load);

  useEffect(() => {
    load();
  }, [load]);

  // Start the embedded chat server if this machine is configured to host one.
  const hostChat = data?.settings.hostChat;
  const chatPort = data?.settings.chatPort;
  useEffect(() => {
    if (hostChat === undefined) return;
    bridge()?.hostChat({ enabled: hostChat, port: chatPort ?? 4455 });
  }, [hostChat, chatPort]);

  if (!data) return <div className="boot">Loading Tour Time…</div>;
  return <Shell />;
}

function Shell() {
  const tour = useActiveTour();
  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <span className="brand-mark">TT</span>
          <span>Tour Time</span>
        </div>
        <TourSwitcher />
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <span className="nav-icon" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">
        {tour ? (
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/advancing" element={<Advancing />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        ) : (
          <div className="empty-state">
            <h2>No tours yet</h2>
            <p>Create a tour from the switcher in the sidebar to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}
