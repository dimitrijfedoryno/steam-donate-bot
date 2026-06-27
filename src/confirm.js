require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const readline = require('readline');

const SteamTotpRaw = require('steam-totp');
const SteamTotp = SteamTotpRaw.default || SteamTotpRaw;

const CFG = {
    accountName: process.env.STEAM_USERNAME || process.env.STEAM_USERNAME_1,
    password: process.env.STEAM_PASSWORD || process.env.STEAM_PASSWORD_1,
    shared_secret: process.env.STEAM_SHARED_SECRET || process.env.STEAM_SHARED_SECRET_1,
    identity_secret: process.env.STEAM_IDENTITY_SECRET || process.env.STEAM_IDENTITY_SECRET_1,
};

if (!CFG.accountName || !CFG.shared_secret) {
    console.error('Chybí Steam přihlašovací údaje v .env (STEAM_USERNAME_1 / STEAM_SHARED_SECRET_1)');
    process.exit(1);
}

console.log(`[${new Date().toLocaleTimeString()}] Startuji confirm pro ${CFG.accountName}...`);

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

function checkConfirmations() {
    const time = Math.floor(Date.now() / 1000);
    const confKey = SteamTotp.getConfirmationKey(CFG.identity_secret, time, 'conf');
    const allowKey = SteamTotp.getConfirmationKey(CFG.identity_secret, time, 'allow');

    community.acceptAllConfirmations(time, confKey, allowKey, (err, confs) => {
        if (err) {
            console.log('Chyba při potvrzování:', err.message);
        } else if (confs && confs.length > 0) {
            console.log(`Automaticky potvrzeno ${confs.length} akcí.`);
        }
    });
}

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
