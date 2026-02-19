require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const STEAM_WEB_API_KEY = process.env.STEAMWEBAPI_TOKEN;

async function testBotLogic() {
    console.log("--- TEST LOGIKY BOTA ---");
    
    // Simulovaný předmět (např. CS2 case)
    const mockItem = {
        market_hash_name: "Revolution Case",
        appid: 730
    };

    console.log(`Testuji zjištění ceny pro: ${mockItem.market_hash_name}`);

    try {
        const url = `https://api.steamwebapi.com/v1/items/info?token=${STEAM_WEB_API_KEY}&market_hash_name=${encodeURIComponent(mockItem.market_hash_name)}&appid=${mockItem.appid}`;
        const response = await axios.get(url);
        const data = response.data.data;

        const price = data.prices?.safe_price || data.prices?.mean_price || 0;
        console.log(`Zjištěná cena: ${price} USD`);

        // Test zápisu do logu
        const logEntry = `[TEST] PŘIJATÝ DAR: ${mockItem.market_hash_name} [${price} USD]\n`;
        fs.appendFileSync('trade_history.log', logEntry, 'utf8');
        
        console.log("Zápis do trade_history.log byl úspěšný!");
    } catch (error) {
        console.error("Chyba při testu:", error.message);
    }
}

testBotLogic();