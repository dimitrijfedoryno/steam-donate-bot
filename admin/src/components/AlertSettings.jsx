import { useState, useEffect, useRef } from 'react';
import { getAlert, getSettings, setSettings } from '../api';

function AlertPreview({ settings }) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef(null);
  const primary = settings.alert_primary_color || '#a4d007';
  const secondary = settings.alert_secondary_color || '#ffcc00';
  const font = settings.alert_font_family || "'Arial Black', sans-serif";
  const duration = settings.alert_duration || 8;

  const showPreview = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(true);
    timeoutRef.current = setTimeout(() => setVisible(false), duration * 1000);
  };

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const previewStyles = {
    box: {
      borderLeft: `6px solid ${primary}`,
      background: 'linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(45,45,45,0.9) 100%)',
      color: 'white',
      padding: '24px',
      borderRadius: '0 16px 16px 0',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      fontFamily: font,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-60px)',
      transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      margin: '20px',
    },
    label: { color: primary, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '8px' },
    user: { fontSize: '2rem', margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    value: { fontSize: '2.5rem', color: secondary, textShadow: '2px 2px 10px rgba(0,0,0,0.5)' },
    item: { fontSize: '1rem', color: '#bbb', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' },
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="stat-label">Náhled alertu</h2>
        <button onClick={showPreview} className="btn-primary text-sm">
          Zobrazit náhled
        </button>
      </div>
      <div className="relative bg-dark-800 rounded-xl overflow-hidden" style={{ minHeight: 220 }}>
        <div style={previewStyles.box}>
          <div style={previewStyles.label}>Nová Nabídka</div>
          <div style={previewStyles.user}>Streamer</div>
          <div style={previewStyles.value}>$50.00</div>
          <div style={previewStyles.item}>Nejdražší: <span style={{ color: '#fff' }}>🔵 AK-47 Redline (Field-Tested)</span></div>
          {settings.donation_goal > 0 && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ width: '100%', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'rgba(255,255,255,0.1)' }}>
                <div style={{
                  height: '100%',
                  borderRadius: '7px',
                  transition: 'width 0.7s ease',
                  width: Math.min(100, ((settings.donation_current || 0) / settings.donation_goal) * 100) + '%',
                  background: `linear-gradient(90deg, ${primary}, ${secondary})`,
                }} />
              </div>
              <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '4px', color: '#aaa' }}>
                Cíl: ${settings.donation_goal.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AlertSettings() {
  const [settings, setSettingsState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [alert, setAlert] = useState(null);
  const [show, setShow] = useState(false);
  const [history, setHistory] = useState([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [minValue, setMinValue] = useState('');
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

  const save = async (partial) => {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await setSettings(partial);
      setSettingsState(updated);
      if (partial.webhook_url !== undefined) setMsg({ type: 'success', text: 'Webhook URL uložena' });
      else if (partial.min_donation_value !== undefined) setMsg({ type: 'success', text: `Minimální hodnota nastavena na $${partial.min_donation_value}` });
      else setMsg({ type: 'success', text: 'Nastavení uloženo' });
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

  const triggerTest = async () => {
    try { await fetch('/api/test-offer'); } catch {}
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(obsUrl);
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

  if (!settings) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Alert</h1>
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
            <button onClick={() => save({ webhook_url: webhookUrl })} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
            <button onClick={testWebhook} disabled={!webhookUrl} className="px-3 py-2 bg-dark-500 hover:bg-dark-400 text-white rounded-lg text-sm transition-colors disabled:opacity-40">
              Odeslat test
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="stat-label mb-3">Minimální hodnota daru</h2>
          <div className="flex items-center gap-3">
            <span className="text-white font-bold">$</span>
            <input type="number" min="0" step="0.01" value={minValue}
              onChange={e => setMinValue(e.target.value)}
              placeholder="0 = všechny dary"
              className="w-32 bg-dark-600 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white font-mono" />
            <button onClick={() => save({ min_donation_value: parseFloat(minValue) || 0 })} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Ukládám...' : 'Uložit'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Dary pod tuto hodnotu se uloží do historie, ale nespustí overlay ani webhook.</p>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="stat-label">Délka trvání alertu</h2>
          <div className="flex items-center gap-4">
            <input type="range" min="3" max="15" value={settings.alert_duration}
              onChange={e => setSettingsState(s => ({ ...s, alert_duration: parseInt(e.target.value) }))}
              className="flex-1 accent-accent-green" />
            <span className="text-white font-bold text-lg w-10 text-right">{settings.alert_duration}s</span>
          </div>
          <button onClick={() => save({ alert_duration: settings.alert_duration })} disabled={saving} className="btn-primary text-sm">
            {saving ? 'Ukládám...' : 'Uložit délku'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="card p-5 space-y-4">
            <h2 className="stat-label">Barvy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1.5">Akcentní (#a4d007)</label>
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
                <label className="text-xs text-gray-400 block mb-1.5">Zlatá (#ffcc00)</label>
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

          <div className="card p-5 space-y-4">
            <h2 className="stat-label">Zvuk</h2>
            <div className="text-sm text-gray-400 mb-2">Aktuální: <span className="text-white font-mono">{settings.alert_sound}</span></div>
            <label className="btn-primary text-sm inline-block cursor-pointer">
              Nahrát vlastní MP3
              <input type="file" accept=".mp3,.wav,.ogg" onChange={handleUpload} className="hidden" />
            </label>
          </div>

          <div className="card p-5 space-y-4">
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

        <div className="space-y-6">
          <AlertPreview settings={settings} />

          <div className="card p-5">
            <h2 className="stat-label mb-3">Live náhled</h2>
            <div className="relative bg-dark-800 rounded-xl overflow-hidden min-h-[200px]">
              <div className={`absolute inset-0 transition-all duration-1000 ${show ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-accent-green/5 via-transparent to-transparent" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-accent-green/5 rounded-full blur-3xl" />
              </div>
              {alert && show ? (
                <div className="relative z-10 text-center pt-12 px-4">
                  <div className="text-accent-green text-sm font-semibold uppercase tracking-[4px] mb-4">Nová Nabídka</div>
                  <div className="text-4xl md:text-5xl font-extrabold text-white mb-2 truncate">{alert.username}</div>
                  <div className="text-4xl md:text-5xl font-extrabold text-accent-gold mb-4 inline-block px-6 py-2 rounded-2xl">${alert.total}</div>
                  <div className="text-base text-gray-400 mt-4 border-t border-dark-500 pt-4 max-w-md mx-auto">
                    Nejdražší: <span className="text-white font-semibold">{alert.topItem || '---'}</span>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 text-center text-gray-400 pt-14">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                  <p className="text-base font-medium">Čekání na nový dar...</p>
                  <p className="text-xs mt-2">Live náhled při příchozím daru</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="stat-label mb-4">Historie alertů (tato relace)</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
              {history.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Zatím žádné alerty</p>}
              {history.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-dark-600/50 border border-dark-500">
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
      </div>
    </div>
  );
}
