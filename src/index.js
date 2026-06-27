require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { startServer } = require('./server');
const AccountBot = require('./account');
const { getItemPrice } = require('./prices');
const { recordOffer } = require('./stats');
const alertQueue = require('./alertQueue');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'trade_history.log');
const ALERT_FILE = path.join(LOG_DIR, 'alert_data.json');
const ALERT_QUEUE_FILE = path.join(LOG_DIR, 'alert_queue.json');
const TEST_TRIGGER_FILE = path.join(LOG_DIR, '_test_trigger.json');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function loadAccounts() {
    const accounts = [];

    // Podpora staré konfigurace (STEAM_USERNAME bez čísla)
    if (process.env.STEAM_USERNAME) {
        accounts.push({
            index: 0,
            username: process.env.STEAM_USERNAME,
            password: process.env.STEAM_PASSWORD,
            shared_secret: process.env.STEAM_SHARED_SECRET,
            identity_secret: process.env.STEAM_IDENTITY_SECRET,
        });
        console.log(`Nalezen starý formát účtu: ${process.env.STEAM_USERNAME}`);
    }

    // Nový formát: STEAM_USERNAME_1, STEAM_USERNAME_2, ...
    for (let i = 1; i <= 20; i++) {
        const username = process.env[`STEAM_USERNAME_${i}`];
        if (!username) continue;
        // Přeskočit duplicitu se starým formátem
        if (i === 1 && process.env.STEAM_USERNAME === username) continue;

        accounts.push({
            index: i,
            username,
            password: process.env[`STEAM_PASSWORD_${i}`],
            shared_secret: process.env[`STEAM_SHARED_SECRET_${i}`],
            identity_secret: process.env[`STEAM_IDENTITY_SECRET_${i}`],
        });
    }

    return accounts;
}

const accounts = loadAccounts();

if (accounts.length === 0) {
    console.error('!!! Nenalezen žádný Steam účet v .env');
    console.error('Přidej STEAM_USERNAME_1, STEAM_PASSWORD_1 atd.');
    process.exit(1);
}

console.log(`\n=== Steam Stream Donate Bot ===`);
console.log(`Počet účtů: ${accounts.length}`);

// Spuštění botů pro každý účet
const bots = accounts.map((config) => {
    return new AccountBot(config, {
        logFile: LOG_FILE,
        alertFile: ALERT_FILE,
        alertQueueFile: ALERT_QUEUE_FILE,
        onReady: (bot) => {
            console.log(`[${bot.name}] Připraven přijímat dary`);
        }
    });
});

// Start HTTP serveru (po vytvoření botů — předává je pro /api/trades)
const port = parseInt(process.env.STEAM_WEB_PORT || '3000', 10);
const httpServer = startServer(port, TEST_TRIGGER_FILE, ALERT_QUEUE_FILE, bots);

// Test trigger watcher (test-offer.js nebo /test-offer endpoint)
function pollTestTrigger() {
    let lastProcessed = 0;
    setInterval(async () => {
        try {
            if (!fs.existsSync(TEST_TRIGGER_FILE)) return;
            const stat = fs.statSync(TEST_TRIGGER_FILE);
            if (stat.mtimeMs <= lastProcessed) return;
            lastProcessed = stat.mtimeMs;

            const raw = fs.readFileSync(TEST_TRIGGER_FILE, 'utf8');
            const data = JSON.parse(raw);
            if (data.processed) return;
            data.processed = true;
            fs.writeFileSync(TEST_TRIGGER_FILE, JSON.stringify(data, null, 2), 'utf8');

            console.log(`\n--- Testovací dar od ${data.username} ---`);
            let totalValue = 0;
            let mostExpensiveItem = { name: '', price: 0 };

            for (const item of data.items) {
                const price = await getItemPrice(item);
                totalValue += price;
                if (price > mostExpensiveItem.price) {
                    mostExpensiveItem = { name: item, price };
                }
            }

            const alertData = {
                username: data.username,
                total: totalValue.toFixed(2),
                topItem: mostExpensiveItem.name || "Neznámý",
                topItemPrice: mostExpensiveItem.price.toFixed(2),
                timestamp: Date.now()
            };

            fs.writeFileSync(ALERT_FILE, JSON.stringify(alertData, null, 2), 'utf8');
            alertQueue.push(ALERT_QUEUE_FILE, alertData);

            const timestamp = new Date().toLocaleString('cs-CZ');
            fs.appendFileSync(LOG_FILE, `[${timestamp}] [TEST] DAR OD: ${data.username} | CELKEM: ${totalValue.toFixed(2)} USD\n`, 'utf8');

            recordOffer(data.username, '', data.items, totalValue);

            console.log(`Hodnota: $${totalValue.toFixed(2)}`);
            console.log(`Nejdražší: ${mostExpensiveItem.name} ($${mostExpensiveItem.price.toFixed(2)})`);
            console.log('------------------------------------');
        } catch (e) {
            // soubor ještě není hotový nebo neexistuje
        }
    }, 1000);
}

pollTestTrigger();

// Status file pro menu + cleanup
const STATUS_FILE = path.join(LOG_DIR, 'bot.running');
fs.writeFileSync(STATUS_FILE, JSON.stringify({ online: true, started: new Date().toISOString() }), 'utf8');

function cleanup() {
    try { fs.unlinkSync(STATUS_FILE); } catch {}
    try { httpServer.close(); } catch {}
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(); });
process.on('SIGTERM', () => { cleanup(); process.exit(); });
