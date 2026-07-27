import { useState, useEffect, useCallback } from 'react';
import { getStatus, getConfirmStatus, startConfirm, stopConfirm, restartBot, get2FACodes, setup2FA, triggerTestDonation, getAccounts, addAccount, updateAccount, deleteAccount } from '../api';

export default function Accounts() {
  const [status, setStatus] = useState(null);
  const [confirmRunning, setConfirmRunning] = useState({});
  const [twoFACodes, setTwoFACodes] = useState({});
  const [twoFAError, setTwoFAError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [restarting, setRestarting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(null);

  // Account management
  const [accounts, setAccounts] = useState([]);
  const [acctLoading, setAcctLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editAcc, setEditAcc] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', shared_secret: '', identity_secret: '', revocation_code: '', personaName: '', play_cs2: true });
  const [saving, setSaving] = useState(false);

  // 2FA setup modal states
  const [setupState, setSetupState] = useState('idle'); // idle | loading | guard | success | error
  const [setupData, setSetupData] = useState({}); // { username, password, domain, result, error }
  const [guardCode, setGuardCode] = useState('');

  const fetchAll = async () => {
    try {
      const [s, c] = await Promise.all([getStatus(), getConfirmStatus()]);
      setStatus(s);
      setConfirmRunning(c.statuses || {});
    } catch {}
  };

  const loadAccounts = async () => {
    try {
      const a = await getAccounts();
      setAccounts(Array.isArray(a) ? a : []);
    } catch {}
    setAcctLoading(false);
  };

  const fetch2FA = useCallback(async () => {
    try {
      const r = await get2FACodes();
      if (r.error) setTwoFAError(r.error);
      else { setTwoFACodes(r); setTwoFAError(null); }
    } catch { setTwoFAError('Chyba načítání 2FA'); }
  }, []);

  useEffect(() => {
    fetchAll();
    loadAccounts();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch2FA();
    const interval = setInterval(fetch2FA, 15000);
    return () => clearInterval(interval);
  }, [fetch2FA]);

  useEffect(() => {
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [Object.values(twoFACodes).map(c => c.code).join('')]);

  const online = status?.online;

  // --- Controls ---
  const handleConfirmToggle = async (accountIndex) => {
    setConfirmLoading(accountIndex);
    try {
      if (confirmRunning[accountIndex]) {
        await stopConfirm(accountIndex);
        setConfirmRunning(prev => ({ ...prev, [accountIndex]: false }));
      } else {
        const r = await startConfirm(accountIndex);
        setConfirmRunning(prev => ({ ...prev, [accountIndex]: r.running }));
      }
    } catch {}
    setConfirmLoading(null);
  };

  const handleRestart = async () => {
    if (!window.confirm('Opravdu restartovat bota? Panel bude na chvíli nedostupný.')) return;
    setRestarting(true);
    try { await restartBot(); } catch {}
  };

  const handleTest = async () => {
    setTestMsg(null);
    try { const r = await triggerTestDonation(); setTestMsg(`Test odeslán jako ${r.donor}`); setTimeout(() => setTestMsg(null), 5000); } catch { setTestMsg('Chyba'); }
  };

  // --- Account CRUD ---
const openAdd = () => {
    setEditAcc(null);
    setFormData({ username: '', password: '', shared_secret: '', identity_secret: '', revocation_code: '', personaName: '', play_cs2: true });
    setSetupState('idle');
    setSetupData({});
    setGuardCode('');
    setShowModal(true);
  };

const openEdit = (acc) => {
    setEditAcc(acc);
    setFormData({
      username: acc.username || '',
      password: acc.password || '',
      shared_secret: acc.shared_secret || '',
      identity_secret: acc.identity_secret || '',
      revocation_code: acc.revocation_code || '',
      personaName: acc.personaName || '',
      play_cs2: acc.play_cs2 !== false,
    });
    setSetupState('idle');
    setSetupData({});
    setGuardCode('');
    setShowModal(true);
  };

  const handleDelete = async (acc) => {
    if (!window.confirm(`Opravdu smazat účet ${acc.username}?`)) return;
    try {
      await deleteAccount(acc.index);
      setAccounts(prev => prev.filter(a => a.index !== acc.index));
    } catch {}
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.username.trim()) return;
    setSaving(true);
    try {
      const data = {
        username: formData.username.trim(),
        password: formData.password,
        shared_secret: formData.shared_secret.trim(),
        identity_secret: formData.identity_secret.trim(),
        revocation_code: formData.revocation_code.trim(),
        play_cs2: formData.play_cs2,
      };
      if (editAcc) {
        const res = await updateAccount({ ...data, index: editAcc.index });
        setAccounts(prev => prev.map(a => a.index === editAcc.index ? { ...a, ...res } : a));
      } else {
        const res = await addAccount(data);
        setAccounts(prev => [...prev, res]);
      }
      setShowModal(false);
    } catch {}
    setSaving(false);
  };

  // --- 2FA Setup Flow ---
  const handleSetupExisting = async (acc) => {
    if (!window.confirm(`Aktivovat mobilní 2FA pro ${acc.username}?\n\nBot musí být přihlášený.`)) return;
    setEditAcc(acc);
    setSetupState('loading');
    setSetupData({ username: acc.username });
    setShowModal(true);
    try {
      const r = await setup2FA({ username: acc.username });
      setSetupData(d => ({ ...d, result: r }));
      setSetupState('success');
      await loadAccounts();
      await fetch2FA();
    } catch (e) {
      setSetupData(d => ({ ...d, error: e.message }));
      setSetupState('error');
    }
  };

  const handleAddWith2FA = async () => {
    if (!formData.username.trim() || !formData.password) return;
    setSetupState('loading');
    setSetupData({ username: formData.username, password: formData.password });
    try {
      const r = await setup2FA({ username: formData.username, password: formData.password });
      if (r.step === 'steam_guard') {
        setSetupData(d => ({ ...d, domain: r.domain }));
        setSetupState('guard');
        return;
      }
      setSetupData(d => ({ ...d, result: r }));
      setSetupState('success');
      await loadAccounts();
      await fetch2FA();
    } catch (e) {
      setSetupData(d => ({ ...d, error: e.message }));
      setSetupState('error');
    }
  };

  const handleGuardSubmit = async () => {
    if (!guardCode.trim()) return;
    setSetupState('loading');
    try {
      const r = await setup2FA({ username: setupData.username, password: setupData.password, guard_code: guardCode });
      setSetupData(d => ({ ...d, result: r }));
      setSetupState('success');
      await loadAccounts();
      await fetch2FA();
    } catch (e) {
      setSetupData(d => ({ ...d, error: e.message }));
      setSetupState('error');
    }
  };

  const closeSetupModal = () => {
    setShowModal(false);
    setSetupState('idle');
    setSetupData({});
    setGuardCode('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Správa a ovládání</h1>

      {/* Bot Controls */}
      <div className="card p-5">
        <h2 className="stat-label mb-4">Ovládání bota</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ControlButton label="Restartovat" desc="Ukončí a restartuje proces" color="yellow" onClick={handleRestart} loading={restarting} disabled={!online}
            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>} />
          <ControlButton label="Test dar" desc="Simuluje příchozí donation" color="green" onClick={handleTest} disabled={!online}
            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>} />
        </div>
        {testMsg && <div className="mt-4 p-3 rounded-lg bg-accent-green/10 border border-accent-green/30 text-accent-green text-sm animate-fade-in">{testMsg}</div>}
        {restarting && <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm animate-fade-in flex items-center gap-2"><div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />Restartuji bota...</div>}
      </div>

      {/* Accounts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="stat-label mb-0">Steam účty</h2>
          <button onClick={openAdd} className="btn-primary text-xs px-3 py-1.5">
            + Přidat účet
          </button>
        </div>
        {acctLoading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" /></div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Žádné účty nenalezeny</p>
            <button onClick={openAdd} className="btn-primary mt-3 text-xs">Přidat první účet</button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(acc => {
              const codeData = twoFACodes[acc.index];
              return (
                <div key={acc.index} className="relative overflow-hidden rounded-lg bg-dark-600/50 border border-dark-500 hover:border-dark-400 transition-colors animate-fade-in group">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-accent-green/20 flex items-center justify-center text-lg font-bold text-accent-green flex-shrink-0">
                        {acc.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{acc.personaName || acc.username}</span>
                          <span className="text-xs text-gray-500">({acc.username})</span>
                          <span className="badge-green text-[10px]">#{acc.index}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[250px]">
                          shared_secret: {acc.shared_secret ? '✓ nastaven' : '✗ chybí'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      {acc.shared_secret && (
                        <button onClick={() => handleConfirmToggle(acc.index)}
                          disabled={confirmLoading === acc.index}
                          className={`p-2 rounded-lg transition-colors ${confirmRunning[acc.index] ? 'hover:bg-red-500/20 text-blue-400 hover:text-red-400' : 'hover:bg-blue-500/20 text-gray-400 hover:text-blue-400'}`}
                          title={confirmRunning[acc.index] ? 'Zastavit confirm' : 'Spustit confirm'}>
                          {confirmLoading === acc.index ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              {confirmRunning[acc.index]
                                ? <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>
                                : <polygon points="5 3 19 12 5 21 5 3" />}
                            </svg>
                          )}
                        </button>
                      )}
                      {!acc.shared_secret && (
                        <button onClick={() => handleSetupExisting(acc)}
                          className="p-2 rounded-lg hover:bg-purple-500/20 text-gray-400 hover:text-purple-400 transition-colors" title="Nastavit 2FA">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        </button>
                      )}
                      <button onClick={() => openEdit(acc)} className="p-2 rounded-lg hover:bg-dark-500 text-gray-400 hover:text-white transition-colors" title="Upravit">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(acc)} className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors" title="Smazat">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                  {/* 2FA kód */}
                  {acc.shared_secret && codeData ? (
                    <div className="px-4 pb-4 pt-0">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-dark-700/50 border border-dark-400">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse-slow" />
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">2FA</span>
                          </div>
                          <span onClick={() => { navigator.clipboard.writeText(codeData.code); setCopied(acc.index); setTimeout(() => setCopied(null), 2000); }}
                            className="text-xl font-mono font-bold text-accent-green tracking-[4px] cursor-pointer select-all hover:text-accent-gold transition-colors" title="Klikni pro kopírování">{codeData.code}</span>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(codeData.code); setCopied(acc.index); setTimeout(() => setCopied(null), 2000); }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${copied === acc.index ? 'bg-accent-green/20 text-accent-green border border-accent-green/40' : 'bg-dark-600 text-gray-400 border border-dark-400 hover:border-gray-400'}`}>
                          {copied === acc.index ? 'Zkopírováno' : 'Kopírovat'}
                        </button>
                      </div>
                    </div>
                  ) : acc.shared_secret && twoFAError ? (
                    <div className="px-4 pb-4 pt-0">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <span className="text-[10px] text-red-400">{twoFAError}</span>
                        <button onClick={fetch2FA} className="text-[10px] underline text-gray-400 hover:text-white">zkusit znovu</button>
                      </div>
                    </div>
                  ) : acc.shared_secret ? (
                    <div className="px-4 pb-4 pt-0">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-dark-700/50 border border-dark-400">
                        <div className="w-3.5 h-3.5 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />
                        <span className="text-[10px] text-gray-400">Načítám 2FA kód...</span>
                      </div>
                    </div>
                  ) : null}
                  {/* Confirm status */}
                  {acc.shared_secret && (
                    <div className="px-4 pb-2 pt-0">
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        confirmRunning[acc.index]
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-dark-700/50 border-dark-400'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            confirmRunning[acc.index] ? 'bg-blue-400 animate-pulse-slow' : 'bg-gray-500'
                          }`} />
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Confirm</span>
                          <span className={`text-xs font-medium ${
                            confirmRunning[acc.index] ? 'text-blue-400' : 'text-gray-500'
                          }`}>
                            {confirmRunning[acc.index] ? 'Aktivní' : 'Vypnutý'}
                          </span>
                        </div>
                        <button
                          onClick={() => handleConfirmToggle(acc.index)}
                          disabled={confirmLoading === acc.index}
                          className={`px-3 py-1.5 rounded-md text-[10px] font-medium transition-all border ${
                            confirmRunning[acc.index]
                              ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30'
                              : 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30'
                          } disabled:opacity-50`}
                        >
                          {confirmLoading === acc.index ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : (
                            confirmRunning[acc.index] ? 'Zastavit' : 'Spustit'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Progress bar */}
                  {acc.shared_secret && codeData && (
                    <div className="h-1 bg-dark-500">
                      <div className="h-full bg-accent-green transition-all duration-1000 ease-linear" style={{ width: `${(countdown / 30) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Config Info */}
      <div className="card p-5">
        <h2 className="stat-label mb-4">Konfigurace</h2>
        <div className="space-y-2 text-sm">
          <ConfigRow label="HTTP port" value={status?.port || '3000'} />
          <ConfigRow label="Confirm service" value={Object.values(confirmRunning).some(v => v) ? 'Aktivní' : 'Vypnutý'} />
          <ConfigRow label="Poslední spuštění" value={status?.started ? new Date(status.started).toLocaleString('cs-CZ') : '---'} />
          <ConfigRow label="Počet účtů" value={String(accounts.length)} />
        </div>
      </div>

      {/* Account / 2FA Setup Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeSetupModal}>
          <div className="card p-6 w-full max-w-md mx-4 animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            <ModalContent mode={(() => {
              if (setupState === 'success') return 'success';
              if (setupState === 'error') return 'error';
              if (setupState === 'guard') return 'guard';
              if (setupState === 'loading' || setupState === 'creating') return 'loading';
              if (editAcc) return 'edit';
              return 'add';
            })()}
              editAcc={editAcc} formData={formData} setFormData={setFormData}
              saving={saving} handleSave={handleSave}
              closeSetupModal={closeSetupModal}
              handleAddWith2FA={handleAddWith2FA}
              setupData={setupData} guardCode={guardCode} setGuardCode={setGuardCode}
              handleGuardSubmit={handleGuardSubmit}
              setupState={setupState}
              onRetry={() => { setSetupState('idle'); setSetupData({}); setEditAcc(null); }}
            />

          </div>
        </div>
      )}
    </div>
  );
}

function ControlButton({ label, desc, icon, color, onClick, loading, disabled }) {
  const map = {
    green: 'from-accent-green/20 to-accent-green/5 border-accent-green/30 text-accent-green hover:bg-accent-green/30',
    red: 'from-red-500/20 to-red-500/5 border-red-500/30 text-red-400 hover:bg-red-500/30',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400 hover:bg-blue-500/30',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400 hover:bg-purple-500/30',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30',
  };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className={`p-4 rounded-xl bg-gradient-to-br ${map[color] || map.green} transition-all duration-200 text-left active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed group`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-black/30 group-hover:scale-110 transition-transform">
          {loading ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
        </div>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <p className="text-xs text-gray-400">{desc}</p>
    </button>
  );
}

function ConfigRow({ label, value }) {
  return (
    <div className="flex justify-between items-center p-2 rounded-lg hover:bg-dark-600/30 transition-colors">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

function SecretField({ label, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          className="input-field font-mono text-xs pr-10 w-full"
          placeholder={placeholder}
          autoComplete="off"
        />
        <button type="button" onClick={() => setVisible(v => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-dark-500 transition-colors"
          tabIndex={-1}>
          {visible ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function ModalContent({ mode, editAcc, formData, setFormData, saving, handleSave, closeSetupModal, handleAddWith2FA, setupData, guardCode, setGuardCode, handleGuardSubmit, setupState, onRetry }) {
  const h = (title) => (
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <button onClick={closeSetupModal} className="p-1 rounded-lg hover:bg-dark-500 text-gray-400 hover:text-white transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  );
  const fi = (label, children) => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );

  // ADD NEW ACCOUNT
  if (mode === 'add') return (
    <>
      {h('Přidat účet')}
      <div className="space-y-4">
        {fi('Steam uživatelské jméno', <input type="text" required value={formData.username} onChange={e => setFormData(f => ({ ...f, username: e.target.value }))} className="input-field" placeholder="např. skinboxboteu" />)}
        {fi('Heslo', <input type="password" required value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} className="input-field" placeholder="••••••••" />)}
        <div className="border-t border-dark-500 pt-4 mt-2">
          <p className="text-xs text-gray-400 mb-3">Hra v profilu</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={formData.play_cs2} onChange={e => setFormData(f => ({ ...f, play_cs2: e.target.checked }))} className="w-4 h-4 rounded border-dark-400 text-accent-green focus:ring-accent-green" />
            <span className="text-sm text-white">Hrát CS2 (zobrazovat v profilu)</span>
          </label>
        </div>
        <div className="border-t border-dark-500 pt-4 mt-2">
          <p className="text-xs text-gray-400 mb-3">Máte 2FA klíče (ze Steam Desktop Authenticator)?</p>
          <SecretField label="Shared secret" value={formData.shared_secret} onChange={e => setFormData(f => ({ ...f, shared_secret: e.target.value }))} placeholder="shared_secret" />
          <div className="mt-3"><SecretField label="Identity secret" value={formData.identity_secret} onChange={e => setFormData(f => ({ ...f, identity_secret: e.target.value }))} placeholder="identity_secret" /></div>
          <div className="mt-3"><SecretField label="Revocation code (volitelné)" value={formData.revocation_code} onChange={e => setFormData(f => ({ ...f, revocation_code: e.target.value }))} placeholder="revocation_code" /></div>
        </div>
        <button onClick={handleSave} disabled={saving || !formData.username} className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-40">
          {saving ? 'Ukládám...' : 'Přidat účet'}
        </button>
      </div>
    </>
  );

  // EDIT EXISTING ACCOUNT
  if (mode === 'edit') return (
    <form onSubmit={handleSave}>
      {h('Upravit účet')}
      <div className="space-y-4">
        {fi('Steam uživatelské jméno', <input type="text" required value={formData.username} onChange={e => setFormData(f => ({ ...f, username: e.target.value }))} className="input-field" />)}
        {fi('Persona Name', <input type="text" value={formData.personaName || ''} onChange={e => setFormData(f => ({ ...f, personaName: e.target.value }))} className="input-field" placeholder="Zobrazované jméno" />)}
        {fi('Heslo', <input type="password" required value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} className="input-field" />)}
        <div className="border-t border-dark-500 pt-4 mt-2">
          <p className="text-xs text-gray-400 mb-3">Hra v profilu</p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={formData.play_cs2} onChange={e => setFormData(f => ({ ...f, play_cs2: e.target.checked }))} className="w-4 h-4 rounded border-dark-400 text-accent-green focus:ring-accent-green" />
            <span className="text-sm text-white">Hrát CS2 (zobrazovat v profilu)</span>
          </label>
        </div>
        <div className="border-t border-dark-500 pt-4 mt-2">
          <p className="text-xs text-gray-400 mb-3">Máte 2FA klíče (ze Steam Desktop Authenticator)?</p>
          <SecretField label="Shared secret" value={formData.shared_secret} onChange={e => setFormData(f => ({ ...f, shared_secret: e.target.value }))} placeholder="shared_secret" />
          <div className="mt-3"><SecretField label="Identity secret" value={formData.identity_secret} onChange={e => setFormData(f => ({ ...f, identity_secret: e.target.value }))} placeholder="identity_secret" /></div>
          <div className="mt-3"><SecretField label="Revocation code (volitelné)" value={formData.revocation_code} onChange={e => setFormData(f => ({ ...f, revocation_code: e.target.value }))} placeholder="revocation_code" /></div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={closeSetupModal} className="flex-1 px-4 py-2 rounded-lg border border-dark-400 text-gray-300 text-sm font-medium hover:bg-dark-600 transition-colors">Zrušit</button>
          <button type="submit" disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin" />}
            Uložit změny
          </button>
        </div>
      </div>
    </form>
  );

  // LOADING
  if (mode === 'loading') return (
    <div className="text-center py-8">
      <div className="w-10 h-10 border-2 border-accent-green/30 border-t-accent-green rounded-full animate-spin mx-auto mb-4" />
      <p className="text-sm text-gray-300">
        {setupState === 'creating' ? 'Přidávám účet a aktivuji 2FA...' : 'Aktivuji 2FA...'}
      </p>
      <p className="text-xs text-gray-500 mt-2">Toto může trvat několik sekund</p>
    </div>
  );

  // STEAM GUARD
  if (mode === 'guard') return (
    <>
      {h('Steam Guard ověření')}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
          <svg className="w-10 h-10 mx-auto text-yellow-400 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <p className="text-sm text-yellow-300">Steam Guard kód byl odeslán</p>
          {setupData.domain && <p className="text-xs text-gray-400 mt-1">na {setupData.domain}</p>}
        </div>
        {fi('Kód z e-mailu', <input type="text" value={guardCode} onChange={e => setGuardCode(e.target.value)} className="input-field text-center text-lg font-mono tracking-[8px]" placeholder="•••••" maxLength={5} autoFocus />)}
        <button onClick={handleGuardSubmit} disabled={guardCode.trim().length < 3} className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 disabled:opacity-40">
          Odeslat kód a aktivovat 2FA
        </button>
        <button onClick={closeSetupModal} className="w-full text-xs text-gray-400 hover:text-white transition-colors">Zrušit</button>
      </div>
    </>
  );

  // SUCCESS
  if (mode === 'success' && setupData.result) return (
    <>
      {h('2FA nastavení')}
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-accent-green/10 border border-accent-green/30 text-center">
          <svg className="w-12 h-12 mx-auto text-accent-green mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="text-accent-green font-bold">{setupData.result.account_created ? 'Účet vytvořen s 2FA!' : '2FA úspěšně aktivována!'}</p>
        </div>
        <div className="space-y-2">
          <div className="p-3 rounded-lg bg-dark-600/50 border border-dark-400">
            <div className="text-[10px] text-gray-500 uppercase mb-1">Shared Secret</div>
            <div className="text-xs font-mono text-gray-200 break-all select-all">{setupData.result.shared_secret}</div>
          </div>
          <div className="p-3 rounded-lg bg-dark-600/50 border border-dark-400">
            <div className="text-[10px] text-gray-500 uppercase mb-1">Identity Secret</div>
            <div className="text-xs font-mono text-gray-200 break-all select-all">{setupData.result.identity_secret}</div>
          </div>
          {setupData.result.revocation_code && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <div className="text-[10px] text-yellow-400 uppercase mb-1">Revocation Code (uschovejte!)</div>
              <div className="text-xs font-mono text-yellow-300 break-all select-all">{setupData.result.revocation_code}</div>
            </div>
          )}
        </div>
        <button onClick={closeSetupModal} className="w-full btn-primary py-2 text-sm">Hotovo</button>
      </div>
    </>
  );

  // ERROR
  if (mode === 'error') return (
    <>
      {h('Chyba')}
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-center mb-4">
        <p className="text-sm text-red-400">{setupData.error || 'Neznámá chyba'}</p>
      </div>
      <div className="flex gap-3">
        <button onClick={closeSetupModal} className="flex-1 px-4 py-2 rounded-lg border border-dark-400 text-gray-300 text-sm font-medium hover:bg-dark-600 transition-colors">Zavřít</button>
        <button onClick={onRetry} className="flex-1 btn-primary text-sm py-2">Zkusit znovu</button>
      </div>
    </>
  );

  return null;
}
