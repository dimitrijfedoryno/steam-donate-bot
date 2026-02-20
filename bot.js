require('dotenv').config();
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity'); 
const TradeOfferManager = require('steam-tradeoffer-manager');
const SteamTotp = require('steam-totp');
const fs = require('fs');
const axios = require('axios');

const LOG_DIRECTORY = './logs';
const LOG_FILE = `${LOG_DIRECTORY}/trade_history.log`;
const STEAM_WEB_API_KEY = process.env.STEAMWEBAPI_TOKEN;

if (!fs.existsSync(LOG_DIRECTORY)) fs.mkdirSync(LOG_DIRECTORY);

const client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
    steam: client,
    domain: 'localhost',
    language: 'en'
});

function logToFile(message) {
    try {
        const timestamp = new Date().toLocaleString('cs-CZ');
        const logEntry = `[${timestamp}] ${message}\n`;
        
        // Použijeme Synchronní zápis pro jistotu, že se data zapíšou hned
        fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
        console.log(`-> Zapsáno do logu: ${LOG_FILE}`); 
    } catch (err) {
        console.error("CHYBA ZÁPISU DO LOGU:", err.message);
    }
}

async function getItemPrice(market_hash_name) {
    try {
        // Použijeme Pricestool API (české, stabilní a zdarma pro CS2)
        const url = `https://api.pricestool.cz/v1/prices/730/${encodeURIComponent(market_hash_name)}`;
        const response = await axios.get(url);
        
        // Pricestool vrací ceny z různých marketů, nás zajímá průměrná 'steam' cena
        const steamData = response.data.markets?.steam;
        
        if (steamData && steamData.price) {
            return parseFloat(steamData.price);
        }
        
        // Pokud není steam cena, zkusíme 'avg' (průměr ze všech marketů)
        return parseFloat(response.data.avg || 0);
    } catch (error) {
        // Pokud selže i tohle, zkusíme úplně nejjednodušší Steam Market API (bez klíče)
        try {
            const steamUrl = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(market_hash_name)}`;
            const steamRes = await axios.get(steamUrl);
            if (steamRes.data && steamRes.data.lowest_price) {
                // Odstraníme symbol měny ($) a převedeme na číslo
                return parseFloat(steamRes.data.lowest_price.replace('$', '').replace(',', '.'));
            }
        } catch (e) {
            console.log(`! Nepodařilo se získat cenu pro: ${market_hash_name}`);
        }
        return 0;
    }
}

client.logOn({
    accountName: process.env.STEAM_USERNAME,
    password: process.env.STEAM_PASSWORD,
    twoFactorCode: SteamTotp.generateAuthCode(process.env.STEAM_SHARED_SECRET)
});

client.on('webSession', (sessionID, cookies) => {
    community.setCookies(cookies);
    manager.setCookies(cookies, (err) => {
        if (!err) {
            console.log('>>> BOT JE ONLINE <<<');
            logToFile('Bot zapnut.');
            setTimeout(() => simulateFakeOffer(), 2000);
        }
    });
});

manager.on('newOffer', async (offer) => {
    if (offer.itemsToGive.length === 0) {
        const partnerID = offer.partner.getSteamID64();
        console.log(`Zpracovávám nabídku od ${partnerID}...`);
        
        let itemsList = [];
        let total = 0;

        for (const item of offer.itemsToReceive) {
            const price = await getItemPrice(item.market_hash_name);
            itemsList.push(`- ${item.market_hash_name} (${price} USD)`);
            total += price;
        }

        const logMsg = `PŘIJATÝ DAR OD: ${partnerID}\nID: ${offer.id}\n${itemsList.join('\n')}\nCELKEM: ${total.toFixed(2)} USD\n-----------------------`;
        
        // VOLÁME ZÁPIS
        logToFile(logMsg);

        offer.accept((err) => {
            if (err) {
                console.log("Chyba při akceptaci: " + err.message);
            } else {
                console.log(`HOTOVO: Nabídka přijata. Hodnota: ${total.toFixed(2)} USD`);
            }
        });
    }
});

async function simulateFakeOffer() {
    console.log("--- TEST: Simuluji příchozí dar ---");
    const fakeOffer = {
        id: 'TEST_' + Math.floor(Math.random() * 1000),
        partner: { getSteamID64: () => '76561198000000000' },
        itemsToGive: [],
        itemsToReceive: [
            { market_hash_name: 'Clutch Case', appid: 730 },
            { market_hash_name: 'Gamma Case', appid: 730 },
            { market_hash_name: 'AK-47 | Slate (Field-Tested)', appid: 730 }
        ],
        accept: (cb) => cb(null)
    };
    manager.emit('newOffer', fakeOffer);
}