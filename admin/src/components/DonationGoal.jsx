import { useState, useEffect } from 'react';
import { getSettings, setSettings, getStats } from '../api';

export default function DonationGoal() {
  const [settings, setSettingsState] = useState(null);
  const [stats, setStatsState] = useState(null);
  const [goalInput, setGoalInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    Promise.all([getSettings(), getStats()]).then(([s, st]) => {
      setSettingsState(s);
      setStatsState(st);
      setGoalInput(String(s.donation_goal || ''));
    }).catch(() => {});
  }, []);

  const currentValue = stats?.value_total || 0;
  const goal = settings?.donation_goal || 0;
  const progress = goal > 0 ? Math.min(100, (currentValue / goal) * 100) : 0;

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const val = parseFloat(goalInput) || 0;
      const updated = await setSettings({ donation_goal: val });
      setSettingsState(updated);
      setMsg({ type: 'success', text: 'Cíl uložen' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const resetGoal = async () => {
    setSaving(true);
    try {
      const updated = await setSettings({ donation_goal: 0 });
      setSettingsState(updated);
      setGoalInput('0');
      setMsg({ type: 'success', text: 'Cíl resetován' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  if (!settings) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Donation Goal</h1>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      <div className="card p-6 space-y-6">
        <div className="text-center">
          <div className="text-4xl font-extrabold text-accent-gold mb-1">${currentValue.toFixed(2)}</div>
          <div className="text-sm text-gray-400">z cíle ${goal.toFixed(2)}</div>
        </div>

        {goal > 0 && (
          <div className="w-full bg-dark-600 rounded-full h-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-accent-green to-accent-gold rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2"
              style={{ width: `${Math.min(100, progress)}%` }}>
              <span className="text-xs font-bold text-black">{progress.toFixed(1)}%</span>
            </div>
          </div>
        )}

        {goal === 0 && (
          <p className="text-center text-sm text-gray-400">Není nastaven žádný cíl. Zadej částku níže.</p>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="stat-label">Nastavit cíl</h2>
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg">$</span>
          <input type="number" min="0" step="0.01" value={goalInput}
            onChange={e => setGoalInput(e.target.value)}
            placeholder="Např. 500"
            className="flex-1 bg-dark-600 border border-dark-500 rounded-lg px-4 py-2.5 text-white text-lg font-mono" />
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? 'Ukládám...' : 'Uložit cíl'}
          </button>
          {goal > 0 && (
            <button onClick={resetGoal} disabled={saving} className="px-4 py-2 bg-dark-500 hover:bg-dark-400 text-gray-300 rounded-lg text-sm transition-colors">
              Resetovat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
