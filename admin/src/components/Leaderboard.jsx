import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api';

export default function Leaderboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        setData(await getLeaderboard());
      } catch {}
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Leaderboard dárců</h1>

      <div className="card p-5">
        {data.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Zatím žádní dárci</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-500">
                  <th className="text-left py-3 px-2 text-gray-400 font-medium w-12">#</th>
                  <th className="text-left py-3 px-2 text-gray-400 font-medium">Dárce</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Hodnota</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium">Počet darů</th>
                  <th className="text-right py-3 px-2 text-gray-400 font-medium hidden sm:table-cell">Nejvyšší dar</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={d.steamId || i} className="border-b border-dark-600/50 hover:bg-dark-600/30 transition-colors">
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-accent-gold/20 text-accent-gold' :
                        i === 1 ? 'bg-gray-400/20 text-gray-300' :
                        i === 2 ? 'bg-amber-700/20 text-amber-500' :
                        'text-gray-500'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-white font-medium truncate max-w-[150px]">{d.name}</td>
                    <td className="py-3 px-2 text-right text-accent-gold font-bold">${d.totalValue.toFixed(2)}</td>
                    <td className="py-3 px-2 text-right text-gray-300">{d.count}</td>
                    <td className="py-3 px-2 text-right text-gray-400 hidden sm:table-cell">${d.topValue ? d.topValue.toFixed(2) : '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
