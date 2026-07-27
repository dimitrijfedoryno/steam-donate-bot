require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const readline = require('readline');

const SteamTotpRaw = require('steam-totp');
const SteamTotp = SteamTotpRaw.default || SteamTotpRaw;

const accountIndex = process.argv[2];

function loadAccountFromEnv(idx) {
    if (!idx || idx === '0' || idx === 'undefined') {
        return {
            accountName: process.env.STEAM_USERNAME,
            password: process.env.STEAM_PASSWORD,
            shared_secret: process.env.STEAM_SHARED_SECRET,
            identity_secret: process.env.STEAM_IDENTITY_SECRET,
        };
    }
    return {
        accountName: process.env[`STEAM_USERNAME_${idx}`],
        password: process.env[`STEAM_PASSWORD_${idx}`],
        shared_secret: process.env[`STEAM_SHARED_SECRET_${idx}`],
        identity_secret: process.env[`STEAM_IDENTITY_SECRET_${idx}`],
    };
}

function loadAccountFromFile(idx) {
    const accountsFile = path.resolve(__dirname, '..', 'logs', 'accounts.json');
    try {
        if (!fs.existsSync(accountsFile)) return null;
        const accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
        if (!Array.isArray(accounts)) return null;
        const numIdx = parseInt(idx, 10);
        return accounts.find(a => a.index === numIdx) || null;
    } catch { return null; }
}

let CFG = loadAccountFromEnv(accountIndex);
if (!CFG.accountName) {
    const fileAcc = loadAccountFromFile(accountIndex);
    if (fileAcc) {
        CFG = {
            accountName: fileAcc.username,
            password: fileAcc.password,
            shared_secret: fileAcc.shared_secret,
            identity_secret: fileAcc.identity_secret,
        };
    }
}

if (!CFG.accountName || !CFG.shared_secret) {
    console.error(`Chybí přihlašovací údaje pro account_index=${accountIndex || '0'}`);
    process.exit(1);
}

console.log(`[${new Date().toLocaleTimeString()}] Startuji confirm pro ${CFG.accountName} (index: ${accountIndex || '0'})...`);

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    domain: 'localhost',
    language: 'en'
});

client.logOn({
    accountName: CFG.accountName,
    password: CFG.password,
    twoFactorCode: SteamTotp.generateAuthCode(CFG.shared_secret)
});

client.on('loggedOn', () => console.log('Přihlášeno k Steamu.'));

client.on('error', (err) => {
    if (err.eresult === 34 || err.message.includes('LogonSessionReplaced')) {
        console.log('Session nahrazena novým přihlášením.');
    } else {
        console.error('Chyba:', err.message);
    }
});

client.on('steamGuard', (domain, callback, lastCodeWrong) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Steam Guard kód (odeslán na ${domain}): `, (code) => {
        rl.close();
        callback(code);
    });
});

client.on('webSession', (sessionID, cookies) => {
    console.log('Relace získána.');
    if (typeof community.setCookies === 'function') {
        community.setCookies(cookies);
        community.oAuthToken = CFG.identity_secret;

        manager.setCookies(cookies, (err) => {
            if (err) console.error('API Error:', err.message);
            else {
                console.log('>>> BOT JE PŘIPRAVEN A FUNKČNÍ <<<');
                checkConfirmations();
            }
        });
    }
});

let checkRunning = false;

function checkConfirmations(attempt = 0) {
    if (checkRunning) return;
    checkRunning = true;
    const time = Math.floor(Date.now() / 1000);
    const confKey = SteamTotp.getConfirmationKey(CFG.identity_secret, time, 'conf');
    const allowKey = SteamTotp.getConfirmationKey(CFG.identity_secret, time, 'allow');

    community.acceptAllConfirmations(time, confKey, allowKey, (err, confs) => {
        checkRunning = false;
        if (err) {
            if (err.message && err.message.includes('429')) {
                const delay = Math.min(30000 * Math.pow(2, attempt), 300000);
                console.log(`Rate limit (429), další pokus za ${Math.round(delay / 1000)}s...`);
                setTimeout(() => checkConfirmations(attempt + 1), delay);
            } else {
                console.log('Chyba při potvrzování:', err.message);
                if (attempt < 3) {
                    setTimeout(() => checkConfirmations(attempt + 1), 10000);
                }
            }
        } else if (confs && confs.length > 0) {
            console.log(`Automaticky potvrzeno ${confs.length} akcí.`);
        }
    });
}

setInterval(checkConfirmations, 30000);

manager.on('newOffer', (offer) => {
    if (offer.itemsToGive.length === 0) {
        console.log('Přijímám dar...');
        offer.accept((err, status) => {
            if (err) {
                console.log('Chyba při přijímání:', err.message);
                return;
            }
            console.log(`Nabídka přijata (Status: ${status}).`);
            if (status === 'pending') {
                console.log('Vyžadováno mobilní potvrzení, potvrzuji...');
                setTimeout(checkConfirmations, 3000);
            }
        });
    }
});
