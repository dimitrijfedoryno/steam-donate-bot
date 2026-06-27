import { useState, useEffect, useRef } from 'react';

export default function Console() {
  const [lines, setLines] = useState([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState('all');
  const bottomRef = useRef(null);
  const bufferRef = useRef([]);

  useEffect(() => {
    const evtSource = new EventSource('/api/console/stream');
    evtSource.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        bufferRef.current = [...bufferRef.current.slice(-999), entry];
        if (!paused) setLines([...bufferRef.current]);
      } catch {}
    };
    evtSource.onerror = () => {};
    return () => evtSource.close();
  }, [paused]);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, paused]);

  const filtered = filter === 'all' ? lines : lines.filter(l => l.level === filter);

  const clearLog = () => { bufferRef.current = []; setLines([]); };

  const copyLog = () => {
    const text = lines.map(l => l.text).join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Live konzole</h1>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="input-field w-auto text-xs py-1.5 px-2">
            <option value="all">Vše</option>
            <option value="info">Info</option>
            <option value="warn">Varování</option>
            <option value="error">Chyby</option>
          </select>
          <button onClick={() => setPaused(!paused)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              paused
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
                : 'bg-dark-500 text-gray-300 border-dark-400 hover:border-gray-400'
            }`}>
            {paused ? '⏸ Pozastaveno' : '▶ Živě'}
          </button>
          <button onClick={copyLog}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-dark-500 text-gray-300 border border-dark-400 hover:border-gray-400 transition-all">
            Kopírovat
          </button>
          <button onClick={clearLog}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all">
            Vymazat
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="bg-dark-800 border-b border-dark-500 px-4 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <div className="w-3 h-3 rounded-full bg-accent-green" />
          <span className="text-xs text-gray-400 ml-2 font-mono">
            {filtered.length} řádků {paused && `(pozastaveno)`}
          </span>
        </div>
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 260px)' }}>
          <div className="p-3 font-mono text-xs leading-relaxed">
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                <svg className="w-10 h-10 mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                </svg>
                <p>Žádné logy{filter !== 'all' ? ` s filtrem "${filter}"` : ''}</p>
              </div>
            )}
            {filtered.map((entry, i) => (
              <div key={i} className={`py-0.5 border-l-2 pl-3 mb-0.5 animate-fade-in ${
                entry.level === 'error' ? 'border-red-500/50 text-red-300' :
                entry.level === 'warn' ? 'border-yellow-500/50 text-yellow-300' :
                'border-transparent text-gray-200'
              }`}>
                <span className="text-gray-500 mr-2 select-none">
                  {new Date(entry.time).toLocaleTimeString('cs-CZ')}
                </span>
                <span className={`mr-1.5 text-[10px] font-bold uppercase ${
                  entry.level === 'error' ? 'text-red-400' :
                  entry.level === 'warn' ? 'text-yellow-400' : 'text-gray-500'
                }`}>
                  [{entry.level}]
                </span>
                {entry.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
