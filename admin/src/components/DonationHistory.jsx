import { useState, useEffect, useMemo } from 'react';
import { getHistory } from '../api';

export default function DonationHistory() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const perPage = 15;

  useEffect(() => {
    const fetch = async () => {
      try {
        const h = await getHistory();
        setAlerts(Array.isArray(h) ? h : []);
      } catch {}
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
    setPage(0);
  };

  const filtered = useMemo(() => {
    const items = alerts.filter(a => a.type === 'donation');
    let result = search
      ? items.filter(a => a.donor?.toLowerCase().includes(search.toLowerCase()))
      : items;

    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'value') cmp = (a.value || 0) - (b.value || 0);
      else if (sortBy === 'donor') cmp = (a.donor || '').localeCompare(b.donor || '');
      else cmp = (a.timestamp || 0) - (b.timestamp || 0);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [alerts, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * perPage, (currentPage + 1) * perPage);

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="text-gray-500 ml-1">↕</span>;
    return <span className="text-accent-green ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Historie darů</h1>
        <div className="flex items-center gap-3">
          <a href="/api/history/csv" download
            className="px-3 py-2 bg-dark-500 hover:bg-dark-400 text-gray-300 rounded-lg text-sm transition-colors flex items-center gap-2 whitespace-nowrap">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </a>
          <div className="relative w-full sm:w-64">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Hledat donora..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="input-field pl-10"
          />
        </div>
      </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-500">
                <Th onClick={() => toggleSort('donor')}><SortIcon field="donor" /> Donor</Th>
                <Th className="hidden md:table-cell">Itemy</Th>
                <Th onClick={() => toggleSort('value')} className="text-right"><SortIcon field="value" /> Hodnota</Th>
                <Th onClick={() => toggleSort('date')} className="text-right"><SortIcon field="date" /> Datum</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-600">
              {paged.length === 0 && (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Žádné záznamy</td></tr>
              )}
              {paged.map((a, i) => (
                <tr key={i} className="hover:bg-dark-600/50 transition-colors animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{a.donor || '---'}</div>
                    {a.steamId && <div className="text-xs text-gray-400 truncate max-w-[160px]">{a.steamId}</div>}
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell">
                    {a.items && a.items.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {a.items.map((item, j) => (
                          <span key={j} className="badge-gray">{item}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">---</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-bold text-accent-gold">${(a.value || 0).toFixed(2)}</span>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400 whitespace-nowrap">
                    {a.date || '---'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">{filtered.length} záznamů</span>
          <div className="flex items-center gap-1">
            <PageBtn disabled={currentPage === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>‹</PageBtn>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(currentPage - 2, totalPages - 5));
              const pageNum = start + i;
              if (pageNum >= totalPages) return null;
              return (
                <PageBtn key={pageNum} active={pageNum === currentPage} onClick={() => setPage(pageNum)}>
                  {pageNum + 1}
                </PageBtn>
              );
            })}
            <PageBtn disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>›</PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, onClick, className = '' }) {
  return (
    <th className={`py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors ${onClick ? '' : 'cursor-default'} ${className}`}
      onClick={onClick}>
      {children}
    </th>
  );
}

function PageBtn({ children, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'bg-accent-green/20 text-accent-green border border-accent-green/40'
          : 'text-gray-400 hover:text-white hover:bg-dark-600 border border-dark-500'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
