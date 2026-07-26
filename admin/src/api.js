const BASE = '';

async function fetchJson(url, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (options.body instanceof FormData) delete headers['Content-Type'];
  const res = await fetch(`${BASE}${url}`, {
    cache: 'no-store',
    headers,
    ...options,
  });
  if (!res.ok) { const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })); throw new Error(err.error); }
  return res.json();
}

export function getStats() { return fetchJson('/api/stats'); }
export function getHistory() { return fetchJson('/api/history'); }
export function getStatus() { return fetchJson('/api/status'); }
export function getAlert() { return fetchJson('/api/alert'); }
export function triggerTestDonation() { return fetchJson('/api/test-offer'); }
export function getConfirmStatus() { return fetchJson('/api/control/confirm'); }
export function startConfirm() { return fetchJson('/api/control/confirm', { method: 'POST', body: JSON.stringify({ action: 'start' }) }); }
export function stopConfirm() { return fetchJson('/api/control/confirm', { method: 'POST', body: JSON.stringify({ action: 'stop' }) }); }
export function restartBot() { return fetchJson('/api/control/bot-restart', { method: 'POST', body: '{}' }); }
export function get2FACodes() { return fetchJson('/api/control/2fa'); }
export function setup2FA(data) { return fetchJson('/api/control/2fa/setup', { method: 'POST', body: JSON.stringify(data) }); }

// Accounts CRUD
export function getAccounts() { return fetchJson('/api/accounts'); }
export function addAccount(data) { return fetchJson('/api/accounts', { method: 'POST', body: JSON.stringify(data) }); }
export function updateAccount(data) { return fetchJson('/api/accounts', { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteAccount(index) { return fetchJson('/api/accounts', { method: 'DELETE', body: JSON.stringify({ index }) }); }

// Trades
export function getTrades() { return fetchJson('/api/trades'); }
export function respondToTrade(offerId, action, accountIndex) {
  return fetchJson('/api/trades', {
    method: 'POST',
    body: JSON.stringify({ offer_id: offerId, action, account_index: accountIndex }),
  });
}

// Bots status
export function getBotsStatus() { return fetchJson('/api/bots/status'); }

// Name cache
export function getNameCache() { return fetchJson('/api/names'); }

// Inventory
export function getInventory(account_index) { return fetchJson('/api/inventory', { method: 'POST', body: JSON.stringify({ account_index }) }); }

// Price status
export function getPriceStatus() { return fetchJson('/api/prices/status'); }
export function getMarketStatus() { return fetchJson('/api/prices/refresh'); }
export function refreshMarketPrices() { return fetchJson('/api/prices/refresh', { method: 'POST', body: '{}' }); }

// Settings
export function getSettings() { return fetchJson('/api/settings'); }
export function setSettings(data) { return fetchJson('/api/settings', { method: 'PUT', body: JSON.stringify(data) }); }

// Leaderboard
export function getLeaderboard() { return fetchJson('/api/leaderboard'); }

// CSV
export function getCsvUrl() { return '/api/history/csv'; }

// Update
export function checkUpdate() { return fetchJson('/api/control/check-update'); }
export function runUpdate() { return fetchJson('/api/control/update', { method: 'POST', body: '{}' }); }
