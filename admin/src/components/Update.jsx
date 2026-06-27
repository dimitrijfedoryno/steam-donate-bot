import { useState, useEffect } from 'react';
import { checkUpdate, runUpdate } from '../api';

export default function Update() {
  const [info, setInfo] = useState(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    checkUpdate().then(setInfo).catch(() => {});
  }, []);

  const handleUpdate = async () => {
    if (!window.confirm('Spustit git pull, přebuildovat admin a restartovat aplikaci?')) return;
    setRunning(true);
    setLog('');
    setMsg(null);
    try {
      const res = await runUpdate();
      setLog(res.log || 'Hotovo');
      setMsg({ type: 'success', text: 'Update dokončen, aplikace se restartuje...' });
    } catch (e) {
      setLog(e.message);
      setMsg({ type: 'error', text: e.message });
      setRunning(false);
    }
  };

  const refreshInfo = async () => {
    setMsg(null);
    try {
      const i = await checkUpdate();
      setInfo(i);
      setMsg({ type: i.behind > 0 ? 'info' : 'success', text: i.behind > 0 ? `${i.behind} nových commitů k dispozici` : 'Aplikace je aktuální' });
    } catch { setMsg({ type: 'error', text: 'Nepodařilo se zkontrolovat' }); }
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Aktualizace</h1>
        <button onClick={refreshInfo} disabled={running} className="btn-primary text-sm">
          Zkontrolovat
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${
          msg.type === 'success' ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' :
          msg.type === 'info' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
          'bg-red-500/10 text-red-400 border border-red-500/30'
        }`}>{msg.text}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs text-gray-400 mb-1">Větev</div>
          <div className="text-sm text-white font-mono">{info?.branch || '---'}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-400 mb-1">Commit</div>
          <div className="text-sm text-white font-mono">{info?.currentCommit || '---'}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-400 mb-1">Datum commitu</div>
          <div className="text-sm text-white">{info?.commitDate || '---'}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs text-gray-400 mb-1">Nové commity</div>
          <div className={`text-2xl font-bold ${info?.behind > 0 ? 'text-accent-gold' : 'text-accent-green'}`}>
            {info?.behind ?? '?'}
          </div>
        </div>
        <div className="card p-5 flex items-end justify-end">
          <button onClick={handleUpdate} disabled={running || !info || info.behind === 0}
            className={`px-6 py-3 rounded-lg font-bold text-sm transition-all ${
              running ? 'bg-dark-500 text-gray-400 cursor-not-allowed' :
              info?.behind > 0 ? 'bg-accent-green/20 text-accent-green border border-accent-green/30 hover:bg-accent-green/30' :
              'bg-dark-500 text-gray-500 cursor-not-allowed'
            }`}>
            {running ? 'Probíhá update...' : info?.behind > 0 ? `Aktualizovat (${info.behind})` : 'Aktuální'}
          </button>
        </div>
      </div>

      {log && (
        <div className="card p-5">
          <h2 className="stat-label mb-3">Výstup</h2>
          <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap bg-dark-800 rounded-lg p-4 max-h-80 overflow-y-auto border border-dark-500">{log}</pre>
        </div>
      )}
    </div>
  );
}
