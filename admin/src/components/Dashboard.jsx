import { useState, useEffect, useMemo } from 'react';
import { getStats, getStatus, getHistory, getBotsStatus } from '../api';
import DonationChart from './DonationChart';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [botsStatus, setBotsStatus] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [s, st, h, bs] = await Promise.all([getStats(), getStatus(), getHistory(), getBotsStatus()]);
        setStats(s);
        setStatus(st);
        setAlerts(Array.isArray(h) ? h : []);
        setBotsStatus(bs);
      } catch {}
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, []);

  const online = status?.online;
  const confirmOn = status?.confirm_running;

  const recentAlerts = useMemo(() => {
    if (!alerts.length) return [];
    return alerts.filter(a => a.type === 'donation').sort((a, b) => b.timestamp - a.timestamp);
  }, [alerts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <div className="flex items-center gap-3">
          {confirmOn && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-slow" />
              Confirm online
            </span>
          )}
          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            online ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${online ? 'bg-accent-green animate-pulse-slow' : 'bg-red-500'}`} />
            {online ? 'Bot Online' : 'Bot Offline'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Přijaté nabídky"
          value={stats?.offers_total ?? 0}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
          accent="green"
        />
        <StatsCard
          title="Přijaté itemy"
          value={stats?.items_total ?? 0}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>}
          accent="blue"
        />
        <StatsCard
          title="Celková hodnota"
          value={`$${(stats?.value_total ?? 0).toFixed(2)}`}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
          accent="gold"
        />
        <StatsCard
          title="Největší donor"
          value={stats?.biggest_donor_name || '---'}
          subtitle={stats?.biggest_donor_value ? `$${stats.biggest_donor_value.toFixed(2)}` : undefined}
          icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
          accent="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="stat-label mb-4">Hodnota darů v čase</h2>
            <DonationChart data={alerts} />
          </div>
        </div>

        <div className="card p-5 flex flex-col">
          <h2 className="stat-label mb-4">Poslední dary</h2>
          <div className="space-y-3 overflow-y-auto max-h-[420px] pr-1">
            {recentAlerts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">Zatím žádné dary</p>
            )}
            {recentAlerts.map((a, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-dark-600/50 border border-dark-500 animate-slide-up flex-shrink-0" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{a.donor}</div>
                  <div className="text-xs text-gray-400">{a.date}</div>
                </div>
                <div className="text-sm font-bold text-accent-gold ml-3">${a.value?.toFixed(2) || '0.00'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="stat-label mb-4">Účty botů</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {botsStatus.length === 0 && (
            <p className="text-sm text-gray-400 col-span-full text-center py-4">Žádné informace o účtech</p>
          )}
          {botsStatus.map((b, i) => (
            <div key={i} className={`p-3 rounded-lg border ${b.online ? (b.reconnecting ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-accent-green/10 border-accent-green/30') : 'bg-red-500/10 border-red-500/30'} flex items-center gap-3`}>
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${b.reconnecting ? 'bg-yellow-400 animate-pulse-slow' : b.online ? 'bg-accent-green animate-pulse-slow' : 'bg-red-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">{b.username}</div>
                <div className="text-xs text-gray-400">
                  {b.reconnecting ? 'Připojování...' : b.online ? 'Online' : b.error || 'Offline'}
                </div>
                {b.online && !b.reconnecting && (
                  <div className="text-xs text-gray-500 mt-1">
                    Dary: {b.donationCount || 0} | Připojen: {new Date(b.connectedAt).toLocaleTimeString('cs-CZ')}
                  </div>
                )}
                {b.lastActivity && b.online && (
                  <div className="text-xs text-gray-600">Posl. aktivita: {new Date(b.lastActivity).toLocaleTimeString('cs-CZ')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="stat-label mb-4">Informace o běhu</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <InfoRow label="Stav" value={online ? 'Online' : 'Offline'} />
          <InfoRow label="Confirm" value={confirmOn ? 'Aktivní' : 'Vypnutý'} />
          <InfoRow label="Poslední spuštění" value={status?.started ? new Date(status.started).toLocaleString('cs-CZ') : '---'} />
          <InfoRow label="API port" value={status?.port || '3000'} />
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, subtitle, icon, accent }) {
  const accentColors = {
    green: 'from-accent-green/20 to-accent-green/5 border-accent-green/30 text-accent-green',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400',
    gold: 'from-accent-gold/20 to-accent-gold/5 border-accent-gold/30 text-accent-gold',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400',
  };
  const color = accentColors[accent] || accentColors.green;

  return (
    <div className={`card p-5 bg-gradient-to-br ${color} relative overflow-hidden group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="stat-label">{title}</div>
          <div className="stat-value">{value}</div>
          {subtitle && <div className="text-xs font-medium text-gray-300">{subtitle}</div>}
        </div>
        <div className="p-2.5 rounded-lg bg-black/30 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
      </div>
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/[0.03] blur-2xl" />
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg bg-dark-600/50 border border-dark-500">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
