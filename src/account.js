const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const readline = require('readline');

const SteamTotpRaw = require('steam-totp');
const SteamTotp = SteamTotpRaw.default || SteamTotpRaw;
const { getItemPrice } = require('./prices');
const { recordOffer } = require('./stats');

class AccountBot {
    constructor(config, { logFile, alertFile, onReady }) {
        this.name = config.username;
        this.index = config.index;
        this.logFile = logFile;
        this.alertFile = alertFile;
        this.onReady = onReady;

        this.client = new SteamUser();
        this.community = new SteamCommunity();
        this.manager = new TradeOfferManager({
            steam: this.client,
            domain: 'localhost',
            language: 'en'
        });

        this.client.logOn({
            accountName: config.username,
            password: config.password,
            twoFactorCode: SteamTotp.generateAuthCode(config.shared_secret)
        });

        this.client.on('error', (err) => {
            console.log(`[${this.name}] Chyba: ${err.message}`);
        });

        this.client.on('steamGuard', (domain, callback, lastCodeWrong) => {
            console.log(`[${this.name}] Steam Guard kód vyžadován (${domain})`);
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question(`[${this.name}] Zadej Steam Guard kód: `, (code) => {
                rl.close();
                callback(code);
            });
        });

        this.client.on('loggedOn', () => {
            console.log(`[${this.name}] Přihlášen ke Steamu`);
        });

        this.client.on('webSession', (sessionID, cookies) => {
            this.community.setCookies(cookies);
            this.manager.setCookies(cookies, (err) => {
                if (err) {
                    console.log(`[${this.name}] API chyba: ${err.message}`);
                    return;
                }
                console.log(`[${this.name}] >>> ONLINE A PŘIPRAVEN <<<`);
                if (this.onReady) this.onReady(this);
            });
        });

        this.manager.on('newOffer', async (offer) => {
            if (offer.itemsToGive.length > 0) return;

            const partnerID = offer.partner.getSteamID64();
            console.log(`[${this.name}] Dar od ${partnerID}, počítám...`);

            this.community.getSteamUser(offer.partner, async (err, user) => {
                const steamName = err ? partnerID : user.name;
                let totalValue = 0;
                let mostExpensiveItem = { name: '', price: 0 };

                for (const item of offer.itemsToReceive) {
                    const price = await getItemPrice(item.market_hash_name);
                    totalValue += price;
                    if (price > mostExpensiveItem.price) {
                        mostExpensiveItem = { name: item.market_hash_name, price };
                    }
                }

                const alertData = {
                    username: steamName,
                    total: totalValue.toFixed(2),
                    topItem: mostExpensiveItem.name || "Neznámý",
                    topItemPrice: mostExpensiveItem.price.toFixed(2),
                    timestamp: Date.now()
                };

                this._writeAlert(alertData);
                this._log(`DAR OD: ${steamName} | CELKEM: ${totalValue.toFixed(2)} USD`);

                offer.accept((acceptErr) => {
                    if (acceptErr) {
                        console.log(`[${this.name}] Chyba akceptace: ${acceptErr.message}`);
                    } else {
                        console.log(`[${this.name}] Nabídka přijata! $${totalValue.toFixed(2)}`);
                        recordOffer(steamName, partnerID, offer.itemsToReceive, totalValue);
                    }
                });
            });
        });
    }

    _log(message) {
        const timestamp = new Date().toLocaleString('cs-CZ');
        const fs = require('fs');
        fs.appendFileSync(this.logFile, `[${timestamp}] [${this.name}] ${message}\n`, 'utf8');
    }

    _writeAlert(data) {
        const fs = require('fs');
        fs.writeFileSync(this.alertFile, JSON.stringify(data, null, 2), 'utf8');
    }
}

module.exports = AccountBot;
