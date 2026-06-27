import { useState, useEffect, useRef } from 'react';
import { getAlert, getSettings, setSettings } from '../api';

export default function LiveAlert() {
  const [alert, setAlert] = useState(null);
  const [show, setShow] = useState(false);
  const [history, setHistory] = useState([]);
  const [settings, setSettingsState] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [minValue, setMinValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const prevTs = useRef(null);
  const obsUrl = `${window.location.origin}/alert.html`;

  useEffect(() => {
    getSettings().then(s => {
      setSettingsState(s);
      setWebhookUrl(s.webhook_url || '');
      setMinValue(String(s.min_donation_value || ''));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getAlert();
        if (data && data.timestamp && data.timestamp !== prevTs.current) {
          prevTs.current = data.timestamp;
          setAlert(data);
          setShow(true);
          setHistory(h => [{ ...data, id: Date.now() }, ...h].slice(0, 20));
          setTimeout(() => setShow(false), 8000);
        }
      } catch {}
    };
    fetch();
    const interval = setInterval(fetch, 1500);
    return () => clearInterval(interval);
  }, []);

  const triggerTest = async () => {
    try {
      await fetch('/api/test-offer');
    } catch {}
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(obsUrl);
  };

  const saveWebhook = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await setSettings({ webhook_url: webhookUrl });
      setSettingsState(updated);
      setMsg({ type: 'success', text: 'Webhook URL uložena' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  const testWebhook = async () => {
    if (!webhookUrl) return;
    try {
      const res = await fetch('/api/test-webhook', { method: 'POST' });
      const data = await res.json();
      setMsg({ type: data.status === 'ok' ? 'success' : 'error', text: data.status === 'ok' ? 'Test odeslán' : data.error || 'Chyba' });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  const saveMinValue = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const val = parseFloat(minValue) || 0;
      const updated = await setSettings({ min_donation_value: val });
      setSettingsState(updated);
      setMsg({ type: 'success', text: `Minimální hodnota nastavena na $${val}` });
    } catch (e) {
      setMsg({ type: 'error', text: e.message });
    }
    setSaving(false);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Live Alert</h1>
        <button onClick={triggerTest} className="btn-primary">
          Testovací dar
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-accent-green/10 text-accent-green border border-accent-green/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="stat-label mb-3">OBS Browser Source</h2>
          <div className="flex items-center gap-3">
            <input type="text" readOnly value={obsUrl}
              className="flex-1 bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono select-all" />
            <button onClick={copyUrl} className="px-4 py-2 bg-dark-500 hover:bg-dark-400 text-white rounded-lg text-sm transition-colors whitespace-nowrap">
              Kopírovat
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Přidej jako Browser Source v OBS. Alerty se frontují a hrají postupně.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="stat-label mb-3">Discord Webhook</h2>
          <div className="flex items-center gap-2 mb-2">
            <input type="url" value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="flex-1 bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white font-mono" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveWebhook} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            <button onClick={testWebhook} disabled={!webhookUrl} className="px-3 py-2 bg-dark-500 hover:bg-dark-400 text-white rounded-lg text-sm transition-colors disabled:opacity-40">
              Odeslat test
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="stat-label mb-3">Minimální hodnota daru pro alert</h2>
        <div className="flex items-center gap-3">
          <span className="text-white font-bold">$</span>
          <input type="number" min="0" step="0.01" value={minValue}
            onChange={e => setMinValue(e.target.value)}
            placeholder="0 = všechny dary"
            className="w-32 bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white font-mono" />
          <button onClick={saveMinValue} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Ukládám...' : 'Uložit'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Dary pod tuto hodnotu se uloží do historie, ale nespustí overlay ani webhook.</p>
      </div>

      <div className="card p-8 flex items-center justify-center min-h-[300px] relative overflow-hidden">
        <div className={`absolute inset-0 transition-all duration-1000 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}>
          <div className="absolute inset-0 bg-gradient-to-br from-accent-green/5 via-transparent to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent-green/5 rounded-full blur-3xl animate-pulse-slow" />
        </div>

        {alert && show && (
          <div className="relative z-10 text-center animate-slide-up">
            <div className="text-accent-green text-sm font-semibold uppercase tracking-[4px] mb-4">
              Nová Nabídka
            </div>
            <div className="text-5xl md:text-6xl font-extrabold text-white mb-2 truncate max-w-lg">
              {alert.username}
            </div>
            <div className="text-5xl md:text-6xl font-extrabold text-accent-gold mb-4 animate-glow inline-block px-6 py-2 rounded-2xl">
              ${alert.total}
            </div>
            <div className="text-lg text-gray-400 mt-4 border-t border-dark-500 pt-4 max-w-md mx-auto">
              Nejdražší: <span className="text-white font-semibold">{alert.topItem || '---'}</span>
            </div>
          </div>
        )}

        {(!alert || !show) && (
          <div className="relative z-10 text-center text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
            <p className="text-lg font-medium">Čekání na nový dar...</p>
            <p className="text-sm mt-2">Live náhled alertu, který se zobrazí při příchozím daru</p>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="stat-label mb-4">Historie alertů (tato relace)</h2>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
          {history.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">Zatím žádné alerty</p>
          )}
          {history.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-600/50 border border-dark-500 animate-slide-in-right">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-2 h-2 rounded-full bg-accent-green flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{a.username}</div>
                  <div className="text-xs text-gray-400">{a.topItem || '---'}</div>
                </div>
              </div>
              <div className="text-sm font-bold text-accent-gold ml-3">${a.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
