const priceHistory = require('./priceHistory');
const marketItems = require('./fetchMarketItems');

const STEAM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const priceCache = new Map();
let lastSteamRequest = 0;
const STEAM_DELAY_MS = 1100;

const loaded = priceHistory.loadIntoMap(priceCache);
if (loaded.count > 0) {
    console.log(`[ceny] Načteno ${loaded.count} cen z cache (${loaded.lastSaved ? new Date(loaded.lastSaved).toLocaleString('cs-CZ') : 'neznámé'})`);
}

const market = marketItems.getStatus();
if (market.totalItems > 0) {
    console.log(`[ceny] Steam Market katalog: ${market.totalItems} předmětů (${market.lastUpdated ? new Date(market.lastUpdated).toLocaleString('cs-CZ') : 'neznámé'})`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': STEAM_UA }, signal: controller.signal });
        if (res.status === 429) throw new Error('429 Too Many Requests');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

function steamGetPrice(market_hash_name) {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(market_hash_name)}`;
    return fetchJson(url);
}

async function getItemPrice(market_hash_name) {
    if (priceCache.has(market_hash_name)) {
        return priceCache.get(market_hash_name);
    }

    const price = await fetchPrice(market_hash_name);
    priceCache.set(market_hash_name, price);
    return price;
}

async function fetchPrice(market_hash_name) {
    const marketPrice = marketItems.getPrice(market_hash_name);
    if (marketPrice !== null) {
        return marketPrice;
    }

    try {
        const sinceLastRequest = Date.now() - lastSteamRequest;
        if (sinceLastRequest < STEAM_DELAY_MS) {
            await sleep(STEAM_DELAY_MS - sinceLastRequest);
        }
        lastSteamRequest = Date.now();

        const data = await steamGetPrice(market_hash_name);
        const priceStr = data.lowest_price || data.median_price;
        if (priceStr) {
            return parseFloat(priceStr.replace('$', '').replace(/,/g, '.'));
        }
    } catch (e) {
        const saved = priceHistory.load();
        const savedPrice = saved.items?.[market_hash_name];
        if (savedPrice && savedPrice > 0) {
            console.log(`[ceny] Steam nedostupný, používám cache: ${market_hash_name} = $${savedPrice}`);
            return savedPrice;
        }
        console.log(`! Chyba ceny u: ${market_hash_name} (${e.message})`);
    }

    return 0;
}

function saveCache() {
    return priceHistory.save(priceCache);
}

async function refreshMarketItems(onProgress) {
    return marketItems.fetchAllItems(onProgress);
}

function startBackgroundRefresh() {
    if (marketItems.getRunning()) return { started: false, reason: 'already_running' };
    marketItems.fetchAllItems((f, t) => {
        if (f % 5000 === 0) console.log(`[market] Stahování: ${f}/${t}`);
    }).then(d => {
        console.log(`[market] Denní aktualizace hotová: ${d.totalItems} předmětů`);
    }).catch(e => {
        console.error(`[market] Chyba při aktualizaci: ${e.message}`);
    });
    return { started: true };
}

function getMarketProgress() {
    return marketItems.getProgress();
}

function getMarketStatus() {
    return marketItems.getStatus();
}

async function getPriceStatus() {
    const marketStatus = marketItems.getStatus();
    const marketProgress = marketItems.getProgress();
    const result = {
        steamMarket: { online: false, latencyMs: null },
        marketItems: { ...marketStatus, progress: marketProgress },
        cacheSize: priceCache.size,
    };

    const testItem = 'AK-47 | Redline (Field-Tested)';

    const sinceLastRequest = Date.now() - lastSteamRequest;
    if (sinceLastRequest < STEAM_DELAY_MS) {
        await sleep(STEAM_DELAY_MS - sinceLastRequest);
    }
    const t = Date.now();
    try {
        const data = await steamGetPrice(testItem);
        result.steamMarket.online = !!(data.lowest_price || data.median_price);
        result.steamMarket.latencyMs = Date.now() - t;
        lastSteamRequest = Date.now();
    } catch (_) {
        result.steamMarket.latencyMs = Date.now() - t;
    }

    return result;
}

module.exports = { getItemPrice, getPriceStatus, saveCache, refreshMarketItems, getMarketStatus, startBackgroundRefresh, getMarketProgress };
