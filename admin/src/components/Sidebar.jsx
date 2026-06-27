import { NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getStatus } from '../api';

const navItems = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, shortcut: '1' },
  { to: '/history', label: 'Historie', icon: HistoryIcon, shortcut: '2' },
  { to: '/statistics', label: 'Statistiky', icon: StatsIcon, shortcut: '3' },
  { to: '/alert', label: 'Alert', icon: LiveIcon, shortcut: '4' },
  { to: '/accounts', label: 'Správa', icon: AccountsIcon, shortcut: '5' },
  { to: '/console', label: 'Konzole', icon: TerminalIcon, shortcut: '6' },
  { to: '/trades', label: 'Obchody', icon: TradeIcon, shortcut: '7' },
  { to: '/goal', label: 'Donation Goal', icon: GoalIcon, shortcut: '8' },
  { to: '/leaderboard', label: 'Leaderboard', icon: LeaderboardIcon, shortcut: '0' },
  { to: '/update', label: 'Aktualizace', icon: UpdateIcon, shortcut: undefined },
];

export default function Sidebar({ collapsed, onToggle }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try { setStatus(await getStatus()); } catch { setStatus(null); }
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, []);

  const online = status?.online;

  return (
    <aside className={`fixed left-0 top-0 h-full z-50 flex flex-col bg-dark-800 border-r border-dark-600 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className={`flex items-center ${collapsed ? 'justify-center py-4' : 'px-5 py-4'} border-b border-dark-600`}>
        {!collapsed && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent-green text-lg">🎮</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white truncate">Steam Donate</div>
              <div className="text-xs text-gray-400 truncate">Admin Panel</div>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-accent-green/20 flex items-center justify-center">
            <span className="text-accent-green text-lg">🎮</span>
          </div>
        )}
        <button onClick={onToggle} className={`${collapsed ? '' : 'ml-2'} p-1.5 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-white transition-colors`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-accent-green/15 text-accent-green shadow-sm shadow-accent-green/5'
                  : 'text-gray-400 hover:text-white hover:bg-dark-600'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="flex-1 truncate">{item.label}</span>
            )}
            {!collapsed && (
              <span className="text-[10px] text-gray-600 font-mono">Ctrl+{item.shortcut}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`border-t border-dark-600 p-4 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div className={`w-3 h-3 rounded-full ${online ? 'bg-accent-green animate-pulse-slow shadow-lg shadow-accent-green/30' : 'bg-red-500'}`} title={online ? 'Online' : 'Offline'} />
        ) : (
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${online ? 'bg-accent-green animate-pulse-slow shadow-lg shadow-accent-green/30' : 'bg-red-500'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-gray-400">Status</div>
              <div className={`text-sm font-semibold ${online ? 'text-accent-green' : 'text-red-400'}`}>
                {online ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function DashboardIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function HistoryIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function StatsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function AccountsIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function TerminalIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}
function LiveIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function TradeIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}
function GoalIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function LeaderboardIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9z" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9z" />
      <path d="M4 22h16" /><path d="M10 22V8h4v14" /><path d="M6 22v-7h4" /><path d="M14 22v-7h4" />
    </svg>
  );
}
function UpdateIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}
