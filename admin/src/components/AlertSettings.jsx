import { useState, useEffect } from 'react';
import { getSettings, setSettings } from '../api';

export default function AlertSettings() {
  const [settings, setSettingsState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    getSettings().then(setSettingsState).catch(() => {});
  }, []);

  const save = async (partial) => {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await setSettings(partial);
      setSettingsState(updated);
      setMsg({ type: 'success', text: 'Nastavení uloženo' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('sound', file);
    try {
      const res = await fetch('/api/upload/sound', { method: 'POST', body: form });
      const data = await res.json();
      if (data.path) {
        await save({ alert_sound: data.path });
        setMsg({ type: 'success', text: 'Zvuk nahrán' });
      } else {
        setMsg({ type: 'error', text: data.error || 'Chyba nahrávání' });
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
  };

  if (!settings) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Nastavení alert overlay</h1>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      <div className="card p-5 space-y-5">
        <h2 className="stat-label">Barvy</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Akcentní barva (#a4d007)</label>
            <div className="flex gap-2">
              <input type="color" value={settings.alert_primary_color}
                onChange={e => setSettingsState(s => ({ ...s, alert_primary_color: e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border border-dark-500" />
              <input type="text" value={settings.alert_primary_color}
                onChange={e => setSettingsState(s => ({ ...s, alert_primary_color: e.target.value }))}
                className="flex-1 bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white font-mono" />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1.5">Zlatá barva (#ffcc00)</label>
            <div className="flex gap-2">
              <input type="color" value={settings.alert_secondary_color}
                onChange={e => setSettingsState(s => ({ ...s, alert_secondary_color: e.target.value }))}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border border-dark-500" />
              <input type="text" value={settings.alert_secondary_color}
                onChange={e => setSettingsState(s => ({ ...s, alert_secondary_color: e.target.value }))}
                className="flex-1 bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white font-mono" />
            </div>
          </div>
        </div>

        <button onClick={() => save({ alert_primary_color: settings.alert_primary_color, alert_secondary_color: settings.alert_secondary_color })}
          disabled={saving} className="btn-primary text-sm">
          {saving ? 'Ukládám...' : 'Uložit barvy'}
        </button>
      </div>

      <div className="card p-5 space-y-5">
        <h2 className="stat-label">Délka trvání</h2>
        <div className="flex items-center gap-4">
          <input type="range" min="3" max="15" value={settings.alert_duration}
            onChange={e => setSettingsState(s => ({ ...s, alert_duration: parseInt(e.target.value) }))}
            className="flex-1 accent-accent-green" />
          <span className="text-white font-bold text-lg w-10 text-right">{settings.alert_duration}s</span>
        </div>
        <button onClick={() => save({ alert_duration: settings.alert_duration })}
          disabled={saving} className="btn-primary text-sm">
          {saving ? 'Ukládám...' : 'Uložit délku'}
        </button>
      </div>

      <div className="card p-5 space-y-5">
        <h2 className="stat-label">Zvuk</h2>
        <div className="text-sm text-gray-400 mb-2">Aktuální: <span className="text-white font-mono">{settings.alert_sound}</span></div>
        <label className="btn-primary text-sm inline-block cursor-pointer">
          Nahrát vlastní MP3
          <input type="file" accept=".mp3,.wav,.ogg" onChange={handleUpload} className="hidden" />
        </label>
      </div>

      <div className="card p-5 space-y-5">
        <h2 className="stat-label">Font</h2>
        <select value={settings.alert_font_family}
          onChange={e => setSettingsState(s => ({ ...s, alert_font_family: e.target.value }))}
          className="w-full bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white">
          <option value="'Arial Black', sans-serif">Arial Black</option>
          <option value="'Impact', sans-serif">Impact</option>
          <option value="'Segoe UI', sans-serif">Segoe UI</option>
          <option value="'Roboto', sans-serif">Roboto</option>
          <option value="'Montserrat', sans-serif">Montserrat</option>
          <option value="'Oswald', sans-serif">Oswald</option>
        </select>
        <button onClick={() => save({ alert_font_family: settings.alert_font_family })}
          disabled={saving} className="btn-primary text-sm">
          {saving ? 'Ukládám...' : 'Uložit font'}
        </button>
      </div>
    </div>
  );
}
