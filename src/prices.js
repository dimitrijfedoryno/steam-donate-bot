const axios = require('axios');

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

module.exports = { getItemPrice };
