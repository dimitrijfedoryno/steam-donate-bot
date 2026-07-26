import { useState, useEffect, useMemo } from 'react';
import { getAccounts, getInventory } from '../api';

const STEAM_ICON = 'https://community.akamai.steamstatic.com/economy/image/';

export default function Inventory() {
  const [accounts, setAccounts] = useState([]);
  const [selectedBot, setSelectedBot] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    getAccounts().then(a => {
      setAccounts(a);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (accounts.length > 0) loadInventory();
  }, [selectedBot, accounts]);

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const acctIndex = accounts[selectedBot]?.index ?? selectedBot;
      const data = await getInventory(acctIndex);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
      setItems([]);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = items;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q));
    }
    if (filter === 'tradable') result = result.filter(i => i.tradable);
    if (filter === 'locked') result = result.filter(i => !i.tradable);
    if (filter === 'marketable') result = result.filter(i => i.marketable);
    result.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'price') return (b.price || 0) - (a.price || 0);
      return 0;
    });
    return result;
  }, [items, search, sort, filter]);

  const totalValue = useMemo(() => items.reduce((s, i) => s + (i.price || 0) * (i.amount || 1), 0), [items]);
  const tradableCount = useMemo(() => items.filter(i => i.tradable).length, [items]);
  const lockedCount = useMemo(() => items.filter(i => !i.tradable).length, [items]);

  const formatLockInfo = (item) => {
    if (item.tradable) return null;
    const now = new Date();
    if (item.trade_hold_until) {
      const exp = new Date(item.trade_hold_until);
      if (exp > now) {
        const diff = exp - now;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        return { type: 'hold', text: timeStr, label: `Trade hold: ${timeStr}` };
      }
    }
    if (item.cache_expiration) {
      const exp = new Date(item.cache_expiration);
      if (exp > now) {
        const diff = exp - now;
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const timeStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;
        return { type: 'hold', text: timeStr, label: `Trade hold: ${timeStr}` };
      }
    }
    return { type: 'permanent', text: 'Permanent', label: 'Trvale neobchodovatelný' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <span className="text-accent-green">📦</span> Inventář
        </h1>
        <button onClick={loadInventory} disabled={loading}
          className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
          {loading ? <span className="animate-spin">⏳</span> : '🔄'} Načíst
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-500">
          <div className="text-xs text-gray-400 mb-1">Celkem předmětů</div>
          <div className="text-xl font-bold text-white">{total}</div>
        </div>
        <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-500">
          <div className="text-xs text-gray-400 mb-1">Obchodovatelné</div>
          <div className="text-xl font-bold text-accent-green">{tradableCount}</div>
        </div>
        <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-500">
          <div className="text-xs text-gray-400 mb-1">Uzamčené</div>
          <div className="text-xl font-bold text-accent-red">{lockedCount}</div>
        </div>
        <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-500">
          <div className="text-xs text-gray-400 mb-1">Celková hodnota</div>
          <div className="text-xl font-bold text-accent-gold">${totalValue.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-dark-700/50 rounded-xl p-4 border border-dark-500">
        <div className="flex flex-wrap gap-3 items-center">
          {accounts.length > 1 && (
            <select value={selectedBot} onChange={e => setSelectedBot(Number(e.target.value))}
              className="bg-dark-600 border border-dark-500 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-green">
              {accounts.map((a, i) => <option key={i} value={i}>{a.username}</option>)}
            </select>
          )}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input type="text" placeholder="Hledat předmět..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full bg-dark-600 border border-dark-500 text-white rounded-lg pl-10 pr-3 py-2 text-sm focus:outline-none focus:border-accent-green" />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="bg-dark-600 border border-dark-500 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-green">
            <option value="name">Řadit: Název</option>
            <option value="price">Řadit: Cena</option>
          </select>
          <div className="flex rounded-lg overflow-hidden border border-dark-500">
            {[['all', 'Vše'], ['tradable', '✅ Obchod.'], ['locked', '🔒 Zamčené'], ['marketable', '🏷️ Trh']].map(([f, l]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${filter === f ? 'bg-accent-green/20 text-accent-green' : 'bg-dark-600 text-gray-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <div>Načítání inventáře...</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((item, i) => {
              const lockInfo = formatLockInfo(item);
              const isPermanent = lockInfo?.type === 'permanent';
            return (
              <div key={item.assetid + '-' + i}
                onClick={() => setSelectedItem(item)}
                className={`relative group rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden animate-fade-in
                  ${item.tradable ? 'bg-dark-700/50 border-dark-500 hover:border-accent-green/50 hover:shadow-lg hover:shadow-accent-green/5' : 'bg-dark-700/30 border-dark-600 opacity-75 hover:opacity-100'}`}
                style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}>
                {!item.tradable && (
                  <div className={`absolute top-1.5 right-1.5 z-10 bg-dark-900/90 rounded-full p-1`}>
                    {(() => {
                      const li = formatLockInfo(item);
                      const isP = li?.type === 'permanent';
                      return (
                        <svg className={`w-3.5 h-3.5 ${isP ? 'text-gray-500' : 'text-orange-400'}`} viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                      );
                    })()}
                  </div>
                )}
                <div className="aspect-square flex items-center justify-center p-2 bg-dark-800/50">
                  {item.icon_url ? (
                    <img src={STEAM_ICON + item.icon_url} alt={item.name} className="max-w-full max-h-full object-contain drop-shadow-lg" loading="lazy" />
                  ) : (
                    <div className="text-gray-600 text-3xl">📦</div>
                  )}
                </div>
                <div className="px-2 py-2">
                  <div className="text-xs text-white font-medium truncate" title={item.name}>{item.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    {item.price > 0 ? (
                      <span className="text-xs font-bold text-accent-gold">${item.price.toFixed(2)}</span>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                    {item.amount > 1 && <span className="text-[10px] bg-dark-600 text-gray-300 rounded px-1.5 py-0.5">x{item.amount}</span>}
                  </div>
                  {lockInfo && (
                    <div className={`flex items-center gap-1 mt-1 ${isPermanent ? 'text-gray-500' : ''}`}>
                      {isPermanent ? (
                        <svg className="w-2.5 h-2.5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                      ) : (
                        <svg className="w-2.5 h-2.5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                        </svg>
                      )}
                      <span className={`text-[10px] font-medium ${isPermanent ? 'text-gray-500' : 'text-orange-400'}`}>{lockInfo.text}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && items.length > 0 && (
        <div className="text-center py-10 text-gray-400">Žádné předměty neodpovídají filtru</div>
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 flex items-center justify-center bg-dark-700/50 rounded-xl flex-shrink-0">
                {selectedItem.icon_url_large ? (
                  <img src={STEAM_ICON + selectedItem.icon_url_large} alt={selectedItem.name} className="max-w-full max-h-full object-contain" />
                ) : selectedItem.icon_url ? (
                  <img src={STEAM_ICON + selectedItem.icon_url} alt={selectedItem.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="text-gray-500 text-4xl">📦</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-white break-words">{selectedItem.name}</div>
                <div className="text-sm text-gray-400 mt-1">{selectedItem.type}</div>
                {selectedItem.rarity && <div className="text-xs text-gray-500 mt-0.5">{selectedItem.rarity}</div>}
                <div className="flex items-center gap-3 mt-3">
                  {selectedItem.price > 0 && <span className="text-lg font-bold text-accent-gold">${selectedItem.price.toFixed(2)}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedItem.tradable ? 'bg-accent-green/20 text-accent-green' : 'bg-red-500/20 text-red-400'}`}>
                    {selectedItem.tradable ? '✅ Obchodovatelný' : '🔒 Zamčený'}
                  </span>
                  {selectedItem.amount > 1 && <span className="text-xs bg-dark-600 text-gray-300 rounded px-2 py-0.5">x{selectedItem.amount}</span>}
                </div>
                {!item.tradable && (() => {
                  const lockInfo = formatLockInfo(item);
                  const isPerm = lockInfo?.type === 'permanent';
                  return (
                    <div className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${isPerm ? 'text-gray-400 bg-dark-600/50' : 'text-orange-400 bg-orange-500/10'}`}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                      </svg>
                      <span>{isPerm ? 'Trvale neobchodovatelný' : `Trade hold: ${lockInfo?.text || 'čekání'}`}</span>
                    </div>
                  );
                })()}
                {selectedItem.owner_descriptions && selectedItem.owner_descriptions.includes('Tradable') && (
                  <div className="mt-2 text-xs text-gray-400">{selectedItem.owner_descriptions}</div>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setSelectedItem(null)} className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-gray-300 rounded-lg text-sm transition-colors">Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
