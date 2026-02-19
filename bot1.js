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

// FUNKCE PRO ZÍSKÁNÍ CENY
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
            // Simulace pro testování (odstraňte v ostrém provozu)
            setTimeout(() => simulateFakeOffer(), 3000);
        }
    });
});

// ZPRACOVÁNÍ NABÍDEK
manager.on('newOffer', async (offer) => {
    // Zpracujeme pouze dary (my nic nedáváme)
    if (offer.itemsToGive.length === 0) {
        const partnerID = offer.partner.getSteamID64();
        console.log(`Příchozí dar od ${partnerID}. Počítám hodnotu...`);

        community.getSteamUser(offer.partner, async (err, user) => {
            const steamName = err ? partnerID : user.name;
            
            let totalValue = 0;
            let mostExpensiveItem = { name: '', price: 0 };
            let itemsList = [];

            // Projdeme všechny itemy v nabídce a sečteme cenu
            for (const item of offer.itemsToReceive) {
                const price = await getItemPrice(item.market_hash_name);
                totalValue += price;
                itemsList.push(`- ${item.market_hash_name} ($${price})`);

                if (price > mostExpensiveItem.price) {
                    mostExpensiveItem = { name: item.market_hash_name, price: price };
                }
            }

            // PŘÍPRAVA DAT PRO OBS ALERT
            const alertData = {
                username: steamName,
                total: totalValue.toFixed(2),
                topItem: mostExpensiveItem.name || "Neznámý",
                topItemPrice: mostExpensiveItem.price.toFixed(2),
                timestamp: Date.now() // Timestamp zajistí, že HTML pozná novou nabídku
            };

            // Zápis do JSONu, který čte alert.html
            fs.writeFileSync(ALERT_DATA_FILE, JSON.stringify(alertData, null, 2), 'utf8');

            // Logování do souboru
            const logMsg = `DAR OD: ${steamName}\nCELKEM: ${totalValue.toFixed(2)} USD\n-----------------------`;
            logToFile(logMsg);

            // Automatické přijetí
            offer.accept((acceptErr) => {
                if (acceptErr) console.log("Chyba při akceptaci: " + acceptErr.message);
                else console.log(`Nabídka přijata! Hodnota: ${totalValue.toFixed(2)} USD`);
            });
        });
    }
});

// FUNKCE PRO SIMULACI TESTU
async function simulateFakeOffer() {
    console.log("--- TEST: Simuluji příchozí dar ---");
    const fakeOffer = {
        id: 'TEST_' + Math.floor(Math.random() * 1000),
        partner: new SteamCommunity.SteamID('76561198000000000'),
        itemsToGive: [],
        itemsToReceive: [
            { market_hash_name: 'AK-47 | Slate (Field-Tested)', appid: 730 },
            { market_hash_name: 'AK-47 | Slate (Field-Tested)', appid: 730 },
            { market_hash_name: 'Clutch Case', appid: 730 }
        ],
        accept: (cb) => cb(null)
    };
    manager.emit('newOffer', fakeOffer);
}