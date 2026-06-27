import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function DonationChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || !data.length) return [];
    const dayMap = {};
    data.forEach(d => {
      if (!d.date || d.type !== 'donation') return;
      const day = d.date.split(' ')[0];
      dayMap[day] = (dayMap[day] || 0) + (d.value || 0);
    });
    return Object.entries(dayMap)
      .map(([day, value]) => ({ day, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => new Date(a.day) - new Date(b.day))
      .slice(-30);
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Zatím žádná data pro graf
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          axisLine={{ stroke: '#333' }}
          tickLine={false}
          tickFormatter={v => v.split('.')[0]}
        />
        <YAxis
          tick={{ fill: '#9ca3af', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `$${v}`}
        />
        <Tooltip
          contentStyle={{
            background: '#111',
            border: '1px solid #333',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            fontSize: '12px',
            color: '#fff',
          }}
          labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
          formatter={(value) => [`$${value.toFixed(2)}`, 'Hodnota']}
          labelFormatter={(label) => `Datum: ${label}`}
        />
        <Bar dataKey="value" fill="#a4d007" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {chartData.map((_, i) => (
            <rect key={i} fill="url(#barGradient)" />
          ))}
        </Bar>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a4d007" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#a4d007" stopOpacity={0.2} />
          </linearGradient>
        </defs>
      </BarChart>
    </ResponsiveContainer>
  );
}
