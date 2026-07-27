const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');

const alertQueue = require('./alertQueue');
const botStatus = require('./botStatus');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

// --- Log capture ---
const MAX_LOG = 1000;
const logBuffer = [];
const pending2FASetups = new Map();

function captureLog(level, args) {
    const text = args.map(a => a === null ? 'null' : typeof a === 'object' ? (a.message || JSON.stringify(a)) : String(a)).join(' ');
    const entry = { text, time: Date.now(), level };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOG) logBuffer.splice(0, logBuffer.length - MAX_LOG);
    return text;
}

const _log = console.log;
console.log = function (...args) { captureLog('info', args); _log.apply(console, args); };

const _warn = console.warn;
console.warn = function (...args) { captureLog('warn', args); _warn.apply(console, args); };

const _error = console.error;
console.error = function (...args) { captureLog('error', args); _error.apply(console, args); };

// --- .env path ---
const ENV_FILE = path.resolve(__dirname, '..', '.env');

function readEnv() {
    return fs.readFileSync(ENV_FILE, 'utf8');
}

function writeEnv(content) {
    fs.writeFileSync(ENV_FILE, content, 'utf8');
    // Reload into process.env
    const parsed = require('dotenv').parse(content);
    for (const [k, v] of Object.entries(parsed)) {
        process.env[k] = v;
    }
}

function getAccounts() {
    const content = readEnv();
    const accounts = [];
    for (let i = 1; i <= 20; i++) {
        const re = new RegExp(`^STEAM_USERNAME_${i}=(.*)$`, 'm');
        const m = content.match(re);
        if (m && m[1].trim()) {
            const pw = content.match(new RegExp(`^STEAM_PASSWORD_${i}=(.*)$`, 'm'));
            const ss = content.match(new RegExp(`^STEAM_SHARED_SECRET_${i}=(.*)$`, 'm'));
            const is = content.match(new RegExp(`^STEAM_IDENTITY_SECRET_${i}=(.*)$`, 'm'));
            const rc = content.match(new RegExp(`^STEAM_REVOCATION_CODE_${i}=(.*)$`, 'm'));
            const pn = content.match(new RegExp(`^STEAM_PERSONA_NAME_${i}=(.*)$`, 'm'));
            const pc = content.match(new RegExp(`^STEAM_PLAY_CS2_${i}=(.*)$`, 'm'));
            accounts.push({
                index: i,
                username: m[1].trim(),
                password: pw ? pw[1].trim() : '',
                shared_secret: ss ? ss[1].trim() : '',
                identity_secret: is ? is[1].trim() : '',
                revocation_code: rc ? rc[1].trim() : '',
                personaName: pn ? pn[1].trim() : '',
                play_cs2: pc ? pc[1].trim() === 'true' : true,
            });
        }
    }
    return accounts;
}

function addAccount(data) {
    const existing = getAccounts();
    const used = new Set(existing.map(a => a.index));
    let idx = 1;
    while (used.has(idx)) idx++;
    const lines = readEnv().split('\n');
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    lines.push('');
    lines.push(`# === Účet ${idx} ===`);
    lines.push(`STEAM_USERNAME_${idx}=${data.username}`);
    lines.push(`STEAM_PASSWORD_${idx}=${data.password}`);
    lines.push(`STEAM_SHARED_SECRET_${idx}=${data.shared_secret || ''}`);
    lines.push(`STEAM_IDENTITY_SECRET_${idx}=${data.identity_secret || ''}`);
    lines.push(`STEAM_REVOCATION_CODE_${idx}=${data.revocation_code || ''}`);
    lines.push(`STEAM_PERSONA_NAME_${idx}=${data.personaName || ''}`);
    lines.push(`STEAM_PLAY_CS2_${idx}=${data.play_cs2 === true}`);
    writeEnv(lines.join('\n'));
    return { index: idx, ...data };
}

function updateAccount(data) {
    let content = readEnv();
    const idx = data.index;
    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
        if (line.startsWith(`STEAM_USERNAME_${idx}=`)) return `STEAM_USERNAME_${idx}=${data.username}`;
        if (line.startsWith(`STEAM_PASSWORD_${idx}=`)) return `STEAM_PASSWORD_${idx}=${data.password}`;
        if (line.startsWith(`STEAM_SHARED_SECRET_${idx}=`)) return `STEAM_SHARED_SECRET_${idx}=${data.shared_secret || ''}`;
        if (line.startsWith(`STEAM_IDENTITY_SECRET_${idx}=`)) return `STEAM_IDENTITY_SECRET_${idx}=${data.identity_secret || ''}`;
        if (line.startsWith(`STEAM_REVOCATION_CODE_${idx}=`)) return `STEAM_REVOCATION_CODE_${idx}=${data.revocation_code || ''}`;
        if (line.startsWith(`STEAM_PERSONA_NAME_${idx}=`)) return `STEAM_PERSONA_NAME_${idx}=${data.personaName || ''}`;
        if (line.startsWith(`STEAM_PLAY_CS2_${idx}=`)) return `STEAM_PLAY_CS2_${idx}=${data.play_cs2 === true}`;
        return line;
    });
    writeEnv(updatedLines.join('\n'));
    return data;
}

function deleteAccount(index) {
    let content = readEnv();
    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
        const re = new RegExp(`^(STEAM_USERNAME_${index}|STEAM_PASSWORD_${index}|STEAM_SHARED_SECRET_${index}|STEAM_IDENTITY_SECRET_${index}|STEAM_REVOCATION_CODE_${index}|STEAM_PERSONA_NAME_${index}|STEAM_PLAY_CS2_${index})=`);
        if (re.test(line)) return '# ' + line;
        return line;
    });
    writeEnv(updatedLines.join('\n'));
    return { deleted: index };
}

function upsertAccountSecrets(index, { shared_secret, identity_secret }) {
    let content = readEnv();
    let lines = content.split('\n');
    let hasS = false, hasI = false;
    lines = lines.map(line => {
        if (line.startsWith(`STEAM_SHARED_SECRET_${index}=`)) { hasS = true; return `STEAM_SHARED_SECRET_${index}=${shared_secret}`; }
        if (line.startsWith(`STEAM_IDENTITY_SECRET_${index}=`)) { hasI = true; return `STEAM_IDENTITY_SECRET_${index}=${identity_secret}`; }
        return line;
    });
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
    if (!hasS) lines.push(`STEAM_SHARED_SECRET_${index}=${shared_secret}`);
    if (!hasI) lines.push(`STEAM_IDENTITY_SECRET_${index}=${identity_secret}`);
    writeEnv(lines.join('\n') + '\n');
}

function startServer(port, testTriggerFile, alertQueueFile, botInstances) {
    const ROOT = path.resolve(__dirname, '..');
    const LOG_DIR = path.join(ROOT, 'logs');
    const ADMIN_DIST = path.join(ROOT, 'admin', 'dist');
    const ALERT_QUEUE_FILE = alertQueueFile || path.join(LOG_DIR, 'alert_queue.json');
    let confirmProcesses = {};

    function sendFile(res, filePath, status = 200) {
        const ext = path.extname(filePath);
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); res.end('Not found'); return; }
            res.writeHead(status, {
                'Content-Type': MIME[ext] || 'application/octet-stream',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
            });
            res.end(data);
        });
    }

    function sendJson(res, data, status = 200) {
        res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
    }

    function readJson(filePath, fallback = null) {
        try { if (!fs.existsSync(filePath)) return fallback; return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
    }

    function collectBody(req, cb) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => { try { cb(JSON.parse(body || '{}')); } catch { cb({}); } });
    }

    function setup2FANewAccount(username, password) {
        return new Promise((resolve, reject) => {
            const SteamTotpRaw = require('steam-totp');
            const SteamTotp = SteamTotpRaw.default || SteamTotpRaw;
            const client = new SteamUser();
            const community = new SteamCommunity();
            let resolved = false;

            const timeout = setTimeout(() => {
                if (!resolved) { resolved = true; reject(new Error('Timeout')); }
            }, 25000);

            client.on('steamGuard', (domain, callback) => {
                pending2FASetups.set(username, {
                    callback,
                    domain,
                    promise: new Promise((res, rej) => {
                        client.once('webSession', (sessionID, cookies) => {
                            community.setCookies(cookies);
                            const tryEnable2FA = (attempt = 1) => {
                                client.enableTwoFactor((err, response) => {
                                    console.log('[2FA DEBUG] attempt', attempt, 'response:', JSON.stringify(response));
                                    if (err) { rej(err); return; }
                                    if (response && response.success) {
                                        res({
                                            shared_secret: response.shared_secret,
                                            identity_secret: response.identity_secret,
                                            revocation_code: response.revocation_code,
                                        });
                                        return;
                                    }
                                    if (response && response.status === 2 && attempt < 5) {
                                        console.log('[2FA] Telefon ještě není propagován, čekám 30s...');
                                        setTimeout(() => tryEnable2FA(attempt + 1), 30000);
                                        return;
                                    }
                                    let msg = '2FA selhalo';
                                    if (response) {
                                        if (response.status === 2) msg = 'Účet nemá ověřené telefonní číslo. Přidej telefon na steamcommunity.com/edit/settings';
                                        else if (response.status === 29) msg = '2FA už je aktivní';
                                        else msg = JSON.stringify(response);
                                    }
                                    rej(new Error(msg));
                                });
                            };
                            tryEnable2FA();
                        });
                        client.once('error', (err) => { rej(err); });
                    }),
                });
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve({ step: 'steam_guard', domain });
                }
            });

            client.on('error', (err) => {
                if (!resolved) { resolved = true; clearTimeout(timeout); reject(err); }
            });

            client.on('webSession', (sessionID, cookies) => {
                community.setCookies(cookies);
                client.enableTwoFactor((err, response) => {
                    clearTimeout(timeout);
                    if (resolved) return;
                    if (err) { resolved = true; reject(err); return; }
                    if (response && response.success) {
                        resolved = true;
                        resolve({
                            shared_secret: response.shared_secret,
                            identity_secret: response.identity_secret,
                            revocation_code: response.revocation_code,
                        });
                        return;
                    }
                    if (response && response.status === 2) {
                        resolved = true;
                        reject(new Error('Účet nemá ověřené telefonní číslo. Přidej telefon na steamcommunity.com/edit/settings a zkus znovu.'));
                        return;
                    }
                    resolved = true;
                    reject(new Error(response ? JSON.stringify(response) : '2FA selhalo'));
                });
            });

            client.logOn({ accountName: username, password });
        });
    }

    function parseHistory() {
        const logFile = path.join(LOG_DIR, 'trade_history.log');
        try {
            if (!fs.existsSync(logFile)) return [];
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            const entries = [];
            for (const line of lines) {
                const match = line.match(/^\[(.+?)\]\s*(.*)/);
                if (!match) continue;
                const dateStr = match[1].trim();
                const rest = match[2];
                if (rest.includes('---')) continue;
                if (rest.startsWith('[TEST]') || rest.startsWith('DAR OD') || rest.startsWith('PŘIJATÝ DAR')) {
                    let donor = 'Neznámý', value = 0, items = [], type = 'donation';
                    const donorMatch = rest.match(/DAR OD:\s*([^\|]+)/);
                    if (donorMatch) donor = donorMatch[1].trim();
                    const valueMatch = rest.match(/CELKEM:\s*\$?([\d.]+)/);
                    if (valueMatch) value = parseFloat(valueMatch[1]);
                    if (!value) { const vMatch = rest.match(/CELKOVÁ HODNOTA:\s*\$?([\d.]+)/); if (vMatch) value = parseFloat(vMatch[1]); }
                    const parsed = dateStr.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
                    const timestamp = parsed ? new Date(+parsed[3], +parsed[2] - 1, +parsed[1], +parsed[4], +parsed[5], +parsed[6]).getTime() : Date.now();
                    entries.push({ date: dateStr, timestamp, donor, value, items, type, steamId: '' });
                }
            }
            return entries;
        } catch { return []; }
    }

    function parseMultipart(buf, boundary) {
        const parts = [];
        const lines = buf.toString('binary').split(new RegExp(`--${boundary}`));
        for (const line of lines) {
            if (line.includes('Content-Disposition')) {
                const headerMatch = line.match(/Content-Disposition:\s*form-data;\s*name="([^"]*)"(?:;\s*filename="([^"]*)")?/);
                if (!headerMatch) continue;
                const name = headerMatch[1];
                const filename = headerMatch[2] || null;
                const contentStart = line.indexOf('\r\n\r\n') + 4;
                const data = Buffer.from(line.slice(contentStart).replace(/\r\n--\s*$/, ''), 'binary');
                parts.push({ name, filename, data });
            }
        }
        return parts;
    }

    function tryListen(currentPort) {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${currentPort}`);
            let p = url.pathname;

            res.setHeader('Access-Control-Allow-Origin', '*');

            // --- API: Stats ---
            if (p === '/api/stats') {
                return sendJson(res, readJson(path.join(LOG_DIR, 'stats.json'), { offers_total: 0, items_total: 0, value_total: 0, biggest_donor_name: '', biggest_donor_steamid: '', biggest_donor_value: 0 }));
            }

            // --- API: History ---
            if (p === '/api/history') return sendJson(res, parseHistory());

            // --- API: Status ---
            if (p === '/api/status') {
                const status = readJson(path.join(LOG_DIR, 'bot.running'), { online: false, started: null });
                status.port = currentPort;
                const anyConfirmRunning = Object.values(confirmProcesses).some(p => p && p.exitCode === null);
                status.confirm_running = anyConfirmRunning;
                return sendJson(res, status);
            }

            // --- API: Bot instances status ---
            if (p === '/api/bots/status') return sendJson(res, botStatus.getAll());

            // --- API: Name cache (steamid -> username) ---
            if (p === '/api/names') {
                const AccountBot = require('./account');
                return sendJson(res, { byId: AccountBot.getNameCache(), byName: AccountBot.getReverseNameCache() });
            }

            // --- API: Inventory ---
            if (p === '/api/inventory') {
                if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed' }, 405);
                return collectBody(req, (data) => {
                    const { account_index } = data;
                    const bot = (botInstances || []).find(b => b.index === account_index);
                    if (!bot) return sendJson(res, { error: 'Bot nenalezen' }, 404);
                    if (!bot.manager.steamID && !bot.client.steamID) return sendJson(res, { error: 'Bot nemá steamID' }, 503);

                    bot.manager.getInventoryContents(730, 2, false, (err, inventory, totalCount) => {
                        if (err) return sendJson(res, { error: err.message }, 500);
                        const items = (inventory || []).map(item => {
                            const ownerDesc = (item.owner_descriptions || []).map(d => d.value || '').join(' ');
                            let trade_hold_until = null;
                            const holdMatch = ownerDesc.match(/(?:Tradable|Tradeable)\s+After\s+(.+?)(?:\.|$)/i);
                            if (holdMatch) {
                                const parsed = new Date(holdMatch[1].trim());
                                if (!isNaN(parsed.getTime()) && parsed > new Date()) {
                                    trade_hold_until = parsed.toISOString();
                                }
                            }
                            return {
                                assetid: item.assetid,
                                name: item.market_hash_name || item.name || 'Neznámý',
                                market_hash_name: item.market_hash_name || '',
                                icon_url: item.icon_url || '',
                                icon_url_large: item.icon_url_large || '',
                                tradable: !!item.tradable,
                                marketable: !!item.marketable,
                                amount: parseInt(item.amount) || 1,
                                type: item.type || '',
                                rarity: (item.tags || []).find(t => t.category === 'Rarity')?.name || '',
                                price: (() => { try { return require('./prices').getItemPrice(item.market_hash_name); } catch { return 0; } })(),
                                trade_hold_until,
                                cache_expiration: item.cache_expiration || null,
                                owner_descriptions: ownerDesc,
                            };
                        });
                        sendJson(res, { items, total: totalCount || items.length, account_index });
                    });
                });
            }

            // --- API: Price status ---
            if (p === '/api/prices/status') {
                const { getPriceStatus } = require('./prices');
                return getPriceStatus().then(s => sendJson(res, s)).catch(() => sendJson(res, { steamMarket: { online: false }, cacheSize: 0 }));
            }

            // --- API: Refresh market items ---
            if (p === '/api/prices/refresh') {
                const { refreshMarketItems, getMarketStatus, getMarketProgress } = require('./prices');
                if (req.method === 'GET') {
                    const status = getMarketStatus();
                    const progress = getMarketProgress();
                    return sendJson(res, { ...status, progress });
                }
                if (req.method === 'POST') {
                    if (getMarketProgress().running) {
                        return sendJson(res, { status: 'already_running', ...getMarketProgress() });
                    }
                    const t = Date.now();
                    refreshMarketItems()
                        .then(data => sendJson(res, { status: 'ok', totalItems: data.totalItems, lastUpdated: data.lastUpdated, durationMs: Date.now() - t }))
                        .catch(e => sendJson(res, { status: 'error', error: e.message }, 500));
                    return;
                }
                return sendJson(res, { error: 'Method not allowed' }, 405);
            }

            // --- API: Settings ---
            if (p === '/api/settings') {
                const settingsMod = require('./settings');
                if (req.method === 'GET') return sendJson(res, settingsMod.load());
                if (req.method === 'PUT') {
                    return collectBody(req, (data) => {
                        const updated = settingsMod.save(data);
                        return sendJson(res, updated);
                    });
                }
                return sendJson(res, { error: 'Method not allowed' }, 405);
            }

            // --- API: Leaderboard ---
            if (p === '/api/leaderboard') {
                const history = parseHistory();
                const donorMap = {};
                for (const entry of history) {
                    if (entry.type !== 'donation') continue;
                    const name = entry.donor || 'Neznámý';
                    if (!donorMap[name]) donorMap[name] = { name, steamId: entry.steamId || '', totalValue: 0, count: 0, topValue: 0 };
                    donorMap[name].totalValue += entry.value || 0;
                    donorMap[name].count += 1;
                    if ((entry.value || 0) > donorMap[name].topValue) donorMap[name].topValue = entry.value || 0;
                }
                const sorted = Object.values(donorMap).sort((a, b) => b.totalValue - a.totalValue).slice(0, 50);
                return sendJson(res, sorted);
            }

            // --- API: History CSV ---
            if (p === '/api/history/csv') {
                const history = parseHistory();
                let csv = 'Datum;Dárce;Hodnota;Itemy;Typ\n';
                for (const entry of history) {
                    if (entry.type !== 'donation') continue;
                    const date = (entry.date || '').replace(/"/g, '""');
                    const donor = (entry.donor || 'Neznámý').replace(/"/g, '""');
                    const items = (entry.items || []).join(', ').replace(/"/g, '""');
                    csv += `"${date}";"${donor}";${entry.value || 0};"${items}";donation\n`;
                }
                res.writeHead(200, {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': 'attachment; filename="donation_history.csv"',
                });
                return res.end('\uFEFF' + csv);
            }

            // --- API: Test Webhook ---
            if (p === '/api/test-webhook' && req.method === 'POST') {
                const settingsMod = require('./settings');
                const webhook = require('./webhook');
                const s = settingsMod.load();
                if (!s.webhook_url) return sendJson(res, { error: 'Není nastavena webhook URL' }, 400);
                const testData = { username: 'StreamFan99', total: '25.50', topItem: 'AK-47 | Redline (Field-Tested)' };
                webhook.send(s.webhook_url, testData).then(result => {
                    if (result && result.status >= 200 && result.status < 300) {
                        sendJson(res, { status: 'ok' });
                    } else {
                        sendJson(res, { error: `Discord vrátil HTTP ${result?.status}` }, 400);
                    }
                }).catch(e => sendJson(res, { error: e.message }, 500));
                return;
            }

            // --- API: Upload sound ---
            if (p === '/api/upload/sound' && req.method === 'POST') {
                const soundsDir = path.join(ROOT, 'sounds');
                if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });
                let body = [];
                req.on('data', chunk => body.push(chunk));
                req.on('end', () => {
                    const buf = Buffer.concat(body);
                    const boundary = req.headers['content-type']?.split('boundary=')[1];
                    if (!boundary) return sendJson(res, { error: 'Missing boundary' }, 400);
                    const parts = parseMultipart(buf, boundary);
                    const filePart = parts.find(p => p.filename);
                    if (!filePart) return sendJson(res, { error: 'No file uploaded' }, 400);
                    const ext = path.extname(filePart.filename) || '.mp3';
                    const filename = 'custom_' + Date.now() + ext;
                    const dest = path.join(soundsDir, filename);
                    fs.writeFileSync(dest, filePart.data);
                    const settingsMod = require('./settings');
                    settingsMod.save({ alert_sound: `sounds/${filename}` });
                    console.log(`Zvuk nahrán: sounds/${filename}`);
                    sendJson(res, { path: `sounds/${filename}` });
                });
                return;
            }

            // --- API: Alert ---
            if (p === '/api/alert') return sendJson(res, readJson(path.join(LOG_DIR, 'alert_data.json'), null));

            if (p === '/api/alert/next') return sendJson(res, alertQueue.next(ALERT_QUEUE_FILE));

            // --- API: Test offer ---
            if (p === '/api/test-offer' && testTriggerFile) {
                const fakeDonors = [
                    { name: 'StreamFan99', items: ['AK-47 | Slate (Field-Tested)', 'Clutch Case', 'Gamma Case'] },
                    { name: 'SkinLoverCZ', items: ['AK-47 | Redline (Field-Tested)', 'Dreams & Nightmares Case'] },
                    { name: 'CS2Player_X', items: ['AWP | Atheris (Field-Tested)'] },
                    { name: 'DonatorKing', items: ['M4A1-S | Hyper Beast (Minimal Wear)', 'Prisma Case', 'Fracture Case', 'Snakebite Case'] },
                    { name: 'Prispevator123', items: ['USP-S | Kill Confirmed (Field-Tested)', 'Clutch Case'] },
                ];
                const donor = fakeDonors[Math.floor(Math.random() * fakeDonors.length)];
                try { fs.writeFileSync(testTriggerFile, JSON.stringify({ username: donor.name, items: donor.items, processed: false }, null, 2), 'utf8'); } catch {}
                return sendJson(res, { status: 'ok', donor: donor.name });
            }

            // --- API: Console SSE stream ---
            if (p === '/api/console/stream') {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                });
                let idx = 0;
                const send = () => {
                    while (idx < logBuffer.length) {
                        res.write(`data: ${JSON.stringify(logBuffer[idx++])}\n\n`);
                    }
                };
                send();
                const timer = setInterval(send, 300);
                req.on('close', () => clearInterval(timer));
                return;
            }

            // --- API: Accounts CRUD ---
            if (p === '/api/accounts') {
                if (req.method === 'GET') return sendJson(res, getAccounts());
                if (req.method === 'POST') {
                    return collectBody(req, (data) => {
                        if (!data.username) return sendJson(res, { error: 'username required' }, 400);
                        try {
                            const acc = addAccount(data);
                            console.log(`Účet přidán: ${data.username} (index ${acc.index})`);
                            return sendJson(res, acc);
                        } catch (e) { return sendJson(res, { error: e.message }, 500); }
                    });
                }
                if (req.method === 'PUT') {
                    return collectBody(req, (data) => {
                        if (!data.index || !data.username) return sendJson(res, { error: 'index and username required' }, 400);
                        try {
                            updateAccount(data);
                            console.log(`Účet upraven: ${data.username} (index ${data.index})`);
                            // Aktualizovat botův config a Rich Presence
                            if (botInstances && data.play_cs2 !== undefined) {
                                const bot = botInstances.find(b => b.index === data.index);
                                if (bot) {
                                    bot.config = { ...bot.config, ...data }; // aktualizovat config v paměti
                                    if (bot.setRichPresence) bot.setRichPresence();
                                }
                            }
                            return sendJson(res, data);
                        } catch (e) { return sendJson(res, { error: e.message }, 500); }
                    });
                }
                if (req.method === 'DELETE') {
                    return collectBody(req, (data) => {
                        if (!data.index) return sendJson(res, { error: 'index required' }, 400);
                        try {
                            deleteAccount(data.index);
                            console.log(`Účet smazán: index ${data.index}`);
                            return sendJson(res, { deleted: data.index });
                        } catch (e) { return sendJson(res, { error: e.message }, 500); }
                    });
                }
                return sendJson(res, { error: 'Method not allowed' }, 405);
            }

            // --- API: Control - Confirm ---
            if (p === '/api/control/confirm') {
                if (req.method === 'GET') {
                    const statuses = {};
                    for (const [idx, proc] of Object.entries(confirmProcesses)) {
                        statuses[idx] = proc && proc.exitCode === null;
                    }
                    return sendJson(res, { statuses });
                }
                if (req.method === 'POST') {
                    return collectBody(req, (data) => {
                        const accountIndex = data.account_index != null ? String(data.account_index) : null;
                        if (data.action === 'start' && accountIndex) {
                            const existing = confirmProcesses[accountIndex];
                            if (existing && existing.exitCode === null) {
                                return sendJson(res, { status: 'ok', running: true, account_index: accountIndex });
                            }
                            const proc = spawn('node', ['src/confirm.js', accountIndex], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
                            proc.stdout.on('data', d => console.log(`[confirm:${accountIndex}] ` + d.toString().trim()));
                            proc.stderr.on('data', d => console.error(`[confirm:${accountIndex}] ` + d.toString().trim()));
                            proc.on('close', () => { delete confirmProcesses[accountIndex]; });
                            confirmProcesses[accountIndex] = proc;
                            return sendJson(res, { status: 'ok', running: true, account_index: accountIndex });
                        }
                        if (data.action === 'stop' && accountIndex) {
                            const proc = confirmProcesses[accountIndex];
                            if (proc && proc.exitCode === null) {
                                proc.kill();
                                delete confirmProcesses[accountIndex];
                                return sendJson(res, { status: 'ok', running: false, account_index: accountIndex });
                            }
                            return sendJson(res, { status: 'ok', running: false, account_index: accountIndex });
                        }
                        if (data.action === 'stop_all') {
                            for (const [idx, proc] of Object.entries(confirmProcesses)) {
                                if (proc && proc.exitCode === null) proc.kill();
                            }
                            confirmProcesses = {};
                            return sendJson(res, { status: 'ok', running: false });
                        }
                        return sendJson(res, { error: 'Invalid action' }, 400);
                    });
                }
                return sendJson(res, { error: 'Method not allowed' }, 405);
            }

            // --- API: 2FA ---
            if (p === '/api/control/2fa') {
                try {
                    const SteamTotpRaw = require('steam-totp');
                    const SteamTotp = SteamTotpRaw.default || SteamTotpRaw;
                    const accounts = getAccounts();
                    const codes = {};
                    for (const acc of accounts) {
                        if (acc.shared_secret) {
                            const code = SteamTotp.generateAuthCode(acc.shared_secret);
                            codes[acc.index] = { code, time: new Date().toLocaleTimeString('cs-CZ'), account_name: acc.username };
                        }
                    }
                    return sendJson(res, codes);
                } catch (e) { return sendJson(res, { error: e.message }, 500); }
            }

            // --- API: 2FA Setup (new account or existing bot) ---
            if (p === '/api/control/2fa/setup' && req.method === 'POST') {
                return collectBody(req, async (data) => {
                    const { username, password, guard_code } = data;

                    // Continuation: user provided Steam Guard code
                    if (guard_code) {
                        const pending = pending2FASetups.get(username);
                        if (!pending) return sendJson(res, { error: 'Platnost kódu vypršela, zkus znovu' }, 400);
                        pending.callback(guard_code);
                        try {
                            const result = await Promise.race([
                                pending.promise,
                                new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), 30000))
                            ]);
                            pending2FASetups.delete(username);
                            addAccount({ username, password, shared_secret: result.shared_secret, identity_secret: result.identity_secret });
                            console.log(`Účet ${username} vytvořen s 2FA`);
                            return sendJson(res, { ...result, account_created: true });
                        } catch (e) {
                            pending2FASetups.delete(username);
                            return sendJson(res, { error: e.message }, 500);
                        }
                    }

                    // Check if this account already has a bot session (existing account)
                    const existingBot = (botInstances || []).find(b => b.username === username);
                    if (existingBot) {
                        try {
                            const result = await existingBot.setup2FA();
                            upsertAccountSecrets(existingBot.index, { shared_secret: result.shared_secret, identity_secret: result.identity_secret });
                            console.log(`2FA aktivována pro účet ${username}`);
                            return sendJson(res, result);
                        } catch (e) {
                            return sendJson(res, { error: e.message }, 500);
                        }
                    }

                    // New account: create temporary Steam session
                    try {
                        const result = await setup2FANewAccount(username, password);
                        if (result && result.step === 'steam_guard') {
                            return sendJson(res, result);
                        }
                        addAccount({ username, password, shared_secret: result.shared_secret, identity_secret: result.identity_secret });
                        console.log(`Účet ${username} vytvořen s 2FA`);
                        return sendJson(res, { ...result, account_created: true });
                    } catch (e) {
                        return sendJson(res, { error: e.message }, 500);
                    }
                });
            }

            // --- API: Check update (git fetch --dry-run) ---
            if (p === '/api/control/check-update') {
                const cp = require('child_process');
                cp.exec('git rev-parse --abbrev-ref HEAD 2>&1', { cwd: ROOT }, (brErr, brOut) => {
                    const branch = (brOut || '').trim() || 'master';
                    const remoteBranch = 'origin/' + branch;
                    cp.exec('git fetch origin 2>&1', { cwd: ROOT }, (fetchErr) => {
                        if (fetchErr) return sendJson(res, { error: fetchErr.message, behind: 0, currentCommit: '---' });
                        cp.exec(`git rev-list HEAD..${remoteBranch} --count 2>&1`, { cwd: ROOT }, (countErr, stdout) => {
                            const behind = (!countErr && parseInt(stdout.trim()) > 0) ? parseInt(stdout.trim()) : 0;
                            cp.exec('git log -1 --format="%h|%ai" 2>&1', { cwd: ROOT }, (hErr, hOut) => {
                                let currentCommit = '---', commitDate = '---';
                                if (!hErr) {
                                    const parts = hOut.trim().split('|');
                                    currentCommit = parts[0] || '---';
                                    commitDate = parts[1] ? parts[1].slice(0, 10) : '---';
                                }
                                sendJson(res, { behind, currentCommit, commitDate, branch, error: null });
                            });
                        });
                    });
                });
                return;
            }

            // --- API: Update (git pull + build + restart) ---
            if (p === '/api/control/update' && req.method === 'POST') {
                const cp = require('child_process');
                const run = (cmd, opts = {}) => new Promise((resolve, reject) => {
                    cp.exec(cmd, { cwd: ROOT, maxBuffer: 16 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
                        resolve({ err, stdout: (stdout || '').trim(), stderr: (stderr || '').trim() });
                    });
                });

                (async () => {
                    let log = [];
                    log.push('=== Git pull ===');
                    const branch = (await run('git rev-parse --abbrev-ref HEAD 2>&1')).stdout.trim() || 'master';
                    const pull = await run(`git pull origin ${branch} 2>&1`);
                    log.push(pull.stdout || pull.stderr);
                    if (pull.err) log.push('CHYBA: ' + pull.err.message);

                    log.push('=== Build admin ===');
                    const build = await run('npm run build', { cwd: path.join(ROOT, 'admin') });
                    log.push(build.stdout || build.stderr);
                    if (build.err) log.push('CHYBA: ' + build.err.message);

                    log.push('=== Restartuji ===');
                    sendJson(res, { status: 'ok', log: log.join('\n') });
                    setTimeout(() => process.exit(0), 1500);
                })();
                return;
            }

            // --- API: Bot restart ---
            if (p === '/api/control/bot-restart' && req.method === 'POST') {
                setTimeout(() => process.exit(0), 500);
                return sendJson(res, { status: 'ok', message: 'Restartuji bota...' });
            }

            // --- API: Trades ---
            if (p === '/api/trades') {
              const tradesFile = path.join(LOG_DIR, 'trades.json');
              if (req.method === 'GET') {
                return sendJson(res, readJson(tradesFile, []));
              }
              if (req.method === 'POST') {
                return collectBody(req, async (data) => {
                  const { action, offer_id, account_index } = data;
                  if (!action || !offer_id) return sendJson(res, { error: 'action and offer_id required' }, 400);
                  const bot = (botInstances || []).find(b => b.index === account_index);
                  if (!bot) return sendJson(res, { error: 'Bot account not found' }, 404);
                  try {
                    const result = await bot.respondToOffer(offer_id, action);
                    return sendJson(res, result);
                  } catch (e) {
                    return sendJson(res, { error: e.message }, 500);
                  }
                });
              }
              return sendJson(res, { error: 'Method not allowed' }, 405);
            }

            // --- Admin SPA ---
            if (p === '/admin' || p.startsWith('/admin/')) {
                let adminPath;
                if (p === '/admin' || p === '/admin/') adminPath = path.join(ADMIN_DIST, 'index.html');
                else adminPath = path.join(ADMIN_DIST, p.replace('/admin/', ''));
                if (fs.existsSync(adminPath) && fs.statSync(adminPath).isFile()) return sendFile(res, adminPath);
                const indexHtml = path.join(ADMIN_DIST, 'index.html');
                if (fs.existsSync(indexHtml)) return sendFile(res, indexHtml);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`<!DOCTYPE html><html><body style="background:#050505;color:#a4d007;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1>Admin Panel</h1><p style="color:#666">Nejprve spusťte: <code style="background:#1a1a1a;padding:4px 8px;border-radius:4px">npm run build:admin</code></p></div></body></html>`);
                return;
            }

            // --- Backward compat test-offer ---
            if (p === '/test-offer' && testTriggerFile) {
                const fakeDonors = [
                    { name: 'StreamFan99', items: ['AK-47 | Slate (Field-Tested)', 'Clutch Case', 'Gamma Case'] },
                    { name: 'SkinLoverCZ', items: ['AK-47 | Redline (Field-Tested)', 'Dreams & Nightmares Case'] },
                    { name: 'CS2Player_X', items: ['AWP | Atheris (Field-Tested)'] },
                    { name: 'DonatorKing', items: ['M4A1-S | Hyper Beast (Minimal Wear)', 'Prisma Case', 'Fracture Case', 'Snakebite Case'] },
                    { name: 'Prispevator123', items: ['USP-S | Kill Confirmed (Field-Tested)', 'Clutch Case'] },
                ];
                const donor = fakeDonors[Math.floor(Math.random() * fakeDonors.length)];
                try { fs.writeFileSync(testTriggerFile, JSON.stringify({ username: donor.name, items: donor.items, processed: false }, null, 2), 'utf8'); } catch {}
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', donor: donor.name }));
                return;
            }

            if (p === '/') p = '/alert.html';
            const filePath = path.join(ROOT, p);
            if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }
            sendFile(res, filePath);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && currentPort < port + 10) {
                console.log(`Port ${currentPort} je obsazený, zkouším ${currentPort + 1}...`);
                server.close(() => tryListen(currentPort + 1));
            } else { console.error(`Port ${currentPort} - ${err.message}`); }
        });

        server.listen(currentPort, () => {
            console.log(`\n=== HTTP Server ===`);
            console.log(`Port: ${currentPort}`);
            console.log(`OBS: http://localhost:${currentPort}/alert.html`);
            console.log(`Admin: http://localhost:${currentPort}/admin`);
            console.log(`Test: http://localhost:${currentPort}/test-offer`);
            console.log(`===================\n`);
        });

        return server;
    }

    return tryListen(port);
}

module.exports = { startServer };

if (require.main === module) {
    require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
    const testTriggerFile = path.resolve(__dirname, '..', 'logs', '_test_trigger.json');
    startServer(process.env.STEAM_WEB_PORT || 3000, testTriggerFile);
}
