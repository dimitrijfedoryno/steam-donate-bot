import { useState, useEffect, useMemo } from 'react';
import { getTrades, respondToTrade } from '../api';

const ICON_BASE = 'https://steamcommunity.com/economy/image/';
const FILTERS = ['all', 'pending', 'accepted', 'declined', 'auto-accepting'];
const STATE_LABELS = {
  pending: 'Čeká na schválení',
  accepted: 'Přijato',
  declined: 'Odmítnuto',
  'auto-accepting': 'Přijímám...',
};
const PAGE_SIZE = 20;

export default function TradeOffers() {
  const [trades, setTrades] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try { setTrades(await getTrades()); } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    let result = filter === 'all' ? trades : trades.filter(t => t.state === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t => (t.partner_name || '').toLowerCase().includes(q));
    }
    return [...result].reverse();
  }, [trades, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleAction = async (offerId, action, accountIndex) => {
    if (action === 'accept' && !window.confirm('Opravdu přijmout tuto nabídku?')) return;
    if (action === 'decline' && !window.confirm('Opravdu odmítnout tuto nabídku?')) return;
    setActing(offerId);
    setError(null);
    try {
      const res = await respondToTrade(offerId, action, accountIndex);
      if (res.error) setError(res.error);
      else { const fresh = await getTrades(); setTrades(fresh); }
    } catch (e) { setError(e.message); }
    setActing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white tracking-tight">Obchodní nabídky</h1>
        <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1 border border-dark-500">
          {FILTERS.map(f => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === f ? 'bg-accent-green/20 text-accent-green' : 'text-gray-400 hover:text-white'
              }`}
            >{f === 'all' ? 'Vše' : STATE_LABELS[f] || f}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Hledat podle jména..."
          className="w-full bg-dark-600 border border-dark-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500" />
      </div>

      {paged.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <p className="text-gray-400 text-sm">Žádné obchodní nabídky</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {paged.map(trade => (
              <TradeCard key={trade.offer_id} trade={trade} acting={acting} onAction={handleAction} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-lg bg-dark-600 border border-dark-500 text-gray-300 text-sm hover:bg-dark-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Předchozí
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${p === safePage ? 'bg-accent-green/20 text-accent-green' : 'bg-dark-600 text-gray-400 hover:bg-dark-500'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-dark-600 border border-dark-500 text-gray-300 text-sm hover:bg-dark-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Další
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TradeCard({ trade, acting, onAction }) {
  const timeAgo = formatTime(trade.created_at);
  const isPending = trade.state === 'pending';

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-dark-600 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-gray-300">#{trade.offer_id}</span>
          <span className={`badge text-[10px] ${
            trade.state === 'accepted' ? 'badge-green' :
            trade.state === 'declined' ? 'badge-red' :
            trade.state === 'auto-accepting' ? 'badge-green' :
            'badge-yellow'
          }`}>{STATE_LABELS[trade.state] || trade.state}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>od <span className="text-gray-300 font-medium">{trade.partner_name}</span></span>
          <span>·</span>
          <span>{timeAgo}</span>
        </div>
      </div>

      <div className="flex items-stretch">
        <div className="flex-1 p-4 md:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-400 mb-3">Dávám já</div>
          {trade.items_to_give.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <span className="px-3 py-1.5 rounded-md bg-dark-700/50 border border-dashed border-dark-400 text-gray-500">—</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trade.items_to_give.map((item, i) => (
                <ItemTile key={i} item={item} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center px-2 border-x border-dark-600 bg-dark-800/30">
          <div className="flex flex-col items-center gap-1 text-gray-500">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent-green mb-3">Dostávám já</div>
          {trade.items_to_receive.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <span className="px-3 py-1.5 rounded-md bg-dark-700/50 border border-dashed border-dark-400 text-gray-500">—</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trade.items_to_receive.map((item, i) => (
                <ItemTile key={i} item={item} side="receive" />
              ))}
            </div>
          )}
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-dark-600 bg-dark-800/50">
          <button
            onClick={() => onAction(trade.offer_id, 'decline', trade.account_index)}
            disabled={acting === trade.offer_id}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-50"
          >
            {acting === trade.offer_id ? (
              <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            )}
            Odmítnout
          </button>
          <button
            onClick={() => onAction(trade.offer_id, 'accept', trade.account_index)}
            disabled={acting === trade.offer_id}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent-green/20 border border-accent-green/30 text-accent-green text-sm font-medium hover:bg-accent-green/30 transition-all disabled:opacity-50"
          >
            {acting === trade.offer_id ? (
              <div className="w-4 h-4 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>
            )}
            Přijmout
          </button>
        </div>
      )}
    </div>
  );
}

function ItemTile({ item, side }) {
  const iconUrl = item.icon_url_large
    ? `${ICON_BASE}${item.icon_url_large}`
    : item.icon_url
      ? `${ICON_BASE}${item.icon_url}`
      : null;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      side === 'receive'
        ? 'bg-accent-green/[0.04] border-accent-green/[0.12] hover:border-accent-green/25 hover:bg-accent-green/[0.08]'
        : 'bg-red-500/[0.04] border-red-500/[0.12] hover:border-red-500/25 hover:bg-red-500/[0.08]'
    }`}>
      <div className="w-[60px] h-[60px] rounded-lg bg-dark-700 flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-white/5">
        {iconUrl ? (
          <img src={iconUrl} alt={item.name} className="w-full h-full object-contain" loading="lazy"
            onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-200 truncate max-w-[200px]">{item.market_hash_name || item.name}</div>
        {item.amount > 1 && <div className="text-xs text-gray-500 mt-0.5">Množství: {item.amount}</div>}
      </div>
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'právě teď';
  if (mins < 60) return `před ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `před ${hours} h`;
  const days = Math.floor(hours / 24);
  return `před ${days} dny`;
}
