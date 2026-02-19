require('dotenv').config();
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity'); 
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamTotp = require('steam-totp');
const fs = require('fs');
const axios = require('axios');

// KONFIGURACE CEST
const LOG_DIRECTORY = './logs';
const LOG_FILE = `${LOG_DIRECTORY}/trade_history.log`;
const ALERT_DATA_FILE = `${LOG_DIRECTORY}/alert_data.json`;
const STEAM_WEB_API_KEY = process.env.STEAMWEBAPI_TOKEN;

// INICIALIZACE SLOŽKY
if (!fs.existsSync(LOG_DIRECTORY)) fs.mkdirSync(LOG_DIRECTORY);

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    domain: 'localhost',
    language: 'en'
});

// POMOCNÁ FUNKCE PRO ZÁPIS DO LOGU
function logToFile(message) {
    const timestamp = new Date().toLocaleString('cs-CZ');
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
}

// FUNKCE PRO CENY (Pricestool API + Fallback na Steam)
async function getItemPrice(market_hash_name) {
    try {
        const url = `https://api.pricestool.cz/v1/prices/730/${encodeURIComponent(market_hash_name)}`;
        const response = await axios.get(url);
        const steamData = response.data.markets?.steam;
        
        if (steamData && steamData.price) return parseFloat(steamData.price);
        return parseFloat(response.data.avg || 0);
    } catch (error) {
        try {
            const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(market_hash_name)}`;
            const steamRes = await axios.get(steamUrl);
            if (steamRes.data && steamRes.data.lowest_price) {
                return parseFloat(steamRes.data.lowest_price.replace('$', '').replace(',', '.'));
            }
        } catch (e) {
            console.log(`! Chyba ceny u: ${market_hash_name}`);
        }
        return 0;
    }
}

// PŘIHLÁŠENÍ
client.logOn({
    accountName: process.env.STEAM_USERNAME,
    password: process.env.STEAM_PASSWORD,
    twoFactorCode: SteamTotp.generateAuthCode(process.env.STEAM_SHARED_SECRET)
});

client.on('webSession', (sessionID, cookies) => {
    community.setCookies(cookies);
    manager.setCookies(cookies, (err) => {
        if (!err) {
            console.log('>>> BOT JE ONLINE A PŘIPRAVEN <<<');
            logToFile('--- BOT SPUŠTĚN ---');
            // Simulace proběhne po 3 sekundách od online stavu
            setTimeout(() => simulateFakeOffer(), 3000);
        }
    });
});

// ZPRACOVÁNÍ NABÍDEK
manager.on('newOffer', async (offer) => {
    if (offer.itemsToGive.length === 0) {
        const partnerID = offer.partner.getSteamID64();
        console.log(`Zpracovávám nabídku od ${partnerID}...`);

        // Získání jména uživatele ze Steamu
        community.getSteamUser(offer.partner, async (err, user) => {
            const steamName = err ? partnerID : user.name;
            
            let itemsList = [];
            let total = 0;
            let mostExpensiveItem = { name: '', price: 0 };

            for (const item of offer.itemsToReceive) {
                const price = await getItemPrice(item.market_hash_name);
                itemsList.push(`- ${item.market_hash_name} (${price} USD)`);
                total += price;

                if (price > mostExpensiveItem.price) {
                    mostExpensiveItem = { name: item.market_hash_name, price: price };
                }
            }

            // Příprava dat pro HTML alert (JSON)
            const alertData = {
                username: steamName,
                total: total.toFixed(2),
                topItem: mostExpensiveItem.name || "Neznámý",
                topItemPrice: mostExpensiveItem.price.toFixed(2),
                timestamp: Date.now()
            };

            // Zápis do JSONu pro OBS
            fs.writeFileSync(ALERT_DATA_FILE, JSON.stringify(alertData, null, 2), 'utf8');

            // Zápis do textového logu
            const logMsg = `DAR OD: ${steamName} (${partnerID})\nID: ${offer.id}\n${itemsList.join('\n')}\nCELKEM: ${total.toFixed(2)} USD\nNEJDRAŽŠÍ: ${mostExpensiveItem.name}\n-----------------------`;
            logToFile(logMsg);

            // Přijetí nabídky
            offer.accept((acceptErr) => {
                if (acceptErr) console.log("Chyba při akceptaci: " + acceptErr.message);
                else console.log(`Nabídka od ${steamName} přijata. Hodnota: ${total.toFixed(2)} USD`);
            });
        });
    }
});

// FUNKCE PRO SIMULACI (PRO OVĚŘENÍ ALERTU A LOGU)
async function simulateFakeOffer() {
    console.log("--- TEST: Simuluji příchozí dar ---");
    const fakeOffer = {
        id: 'SIMULACE_' + Math.floor(Math.random() * 1000),
        partner: new SteamCommunity.SteamID('76561198000000000'), // Musí být SteamID objekt
        itemsToGive: [],
        itemsToReceive: [
            { market_hash_name: 'Clutch Case', appid: 730 },
            { market_hash_name: 'AK-47 | Slate (Field-Tested)', appid: 730 }
        ],
        accept: (cb) => cb(null)
    };
    manager.emit('newOffer', fakeOffer);
}