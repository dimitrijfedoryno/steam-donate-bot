import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { getStats, getHistory } from '../api';

const PIE_COLORS = ['#a4d007', '#ffcc00', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#fb923c', '#f87171'];

export default function Statistics() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [s, h] = await Promise.all([getStats(), getHistory()]);
        setStats(s);
        setAlerts(Array.isArray(h) ? h : []);
      } catch {}
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, []);

  const monthlyData = useMemo(() => {
    const donations = alerts.filter(a => a.type === 'donation');
    const monthMap = {};
    donations.forEach(d => {
      if (!d.date) return;
      const parts = d.date.split(' ');
      const monthKey = parts.length > 1 ? parts[1] : '---';
      monthMap[monthKey] = (monthMap[monthKey] || 0) + (d.value || 0);
    });
    return Object.entries(monthMap).map(([month, value]) => ({
      month,
      value: Math.round(value * 100) / 100,
    }));
  }, [alerts]);

  const donorData = useMemo(() => {
    const donations = alerts.filter(a => a.type === 'donation');
    const donorMap = {};
    donations.forEach(d => {
      const name = d.donor || 'Neznámý';
      donorMap[name] = (donorMap[name] || 0) + (d.value || 0);
    });
    return Object.entries(donorMap)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [alerts]);

  const avgValue = stats?.offers_total ? (stats.value_total / stats.offers_total).toFixed(2) : '0.00';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Statistiky</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Prům. hodnota" value={`$${avgValue}`} />
        <MiniStat label="Celkem itemů" value={stats?.items_total ?? 0} />
        <MiniStat label="Celkem nabídek" value={stats?.offers_total ?? 0} />
        <MiniStat label="Nejvyšší donor" value={stats?.biggest_donor_name || '---'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="stat-label mb-4">Hodnota dle měsíců</h2>
          {monthlyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={{ stroke: '#333' }} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip cursor={{ fill: '#2a2a2a' }}
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                  labelStyle={{ color: '#9ca3af', fontWeight: 500 }}
                  itemStyle={{ color: '#a4d007', fontWeight: 600 }}
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Hodnota']} />
                <Bar dataKey="value" fill="#a4d007" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {monthlyData.map((_, i) => (
                    <rect key={i} fill="url(#barGradient2)" />
                  ))}
                </Bar>
                <defs>
                  <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a4d007" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#a4d007" stopOpacity={0.2} />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">Zatím žádná data</div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="stat-label mb-4">Top dárcové</h2>
          {donorData.length > 0 ? (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={donorData} cx="50%" cy="50%" innerRadius={40} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {donorData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    labelStyle={{ color: '#fff', fontWeight: 500 }}
                    itemStyle={{ color: '#a4d007', fontWeight: 600 }}
                    formatter={(value, name) => [`$${value.toFixed(2)}`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 w-full space-y-2">
                {donorData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-dark-600/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm text-white truncate">{d.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-accent-gold ml-2">${d.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">Zatím žádná data</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="card p-4">
      <div className="stat-label mb-1">{label}</div>
      <div className="text-lg font-bold text-white truncate">{value}</div>
    </div>
  );
}
