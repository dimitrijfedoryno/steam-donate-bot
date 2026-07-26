const fs = require('fs');
const path = require('path');

const ITEMS_FILE = path.join(__dirname, '..', 'logs', 'market_items.json');
const API_URL = 'https://market.csgo.com/api/v2/prices/USD.json';

let running = false;
let progress = { fetched: 0, total: 0, percent: 0 };

function loadItems() {
    try {
        if (!fs.existsSync(ITEMS_FILE)) return { items: {}, lastUpdated: null, totalItems: 0, resumeFrom: 0, totalCount: 0 };
        return JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8'));
    } catch {
        return { items: {}, lastUpdated: null, totalItems: 0, resumeFrom: 0, totalCount: 0 };
    }
}

function saveItems(data) {
    const dir = path.dirname(ITEMS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ITEMS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function fetchAllItems(onProgress) {
    if (running) throw new Error('Již probíhá stahování');
    running = true;
    progress = { fetched: 0, total: 0, percent: 0 };

    try {
        console.log('[market] Stahuji ceny z market.csgo.com...');
        if (onProgress) onProgress(0, 0);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        let res;
        try {
            res = await fetch(API_URL, { signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.success) throw new Error('market.csgo.com API: success=false');

        const items = {};
        for (const item of data.items) {
            items[item.market_hash_name] = {
                price: parseFloat(item.price),
                volume: parseInt(item.volume) || 0,
            };
        }

        const total = Object.keys(items).length;
        progress = { fetched: total, total, percent: 100 };
        if (onProgress) onProgress(total, total);

        const result = { items, lastUpdated: new Date().toISOString(), totalItems: total, resumeFrom: 0, totalCount: total };
        saveItems(result);
        console.log(`[market] Hotovo: ${total} předmětů z market.csgo.com`);
        return result;
    } finally {
        running = false;
    }
}

function getPrice(market_hash_name) {
    const data = loadItems();
    const item = data.items?.[market_hash_name];
    return item ? item.price : null;
}

function isAvailable() {
    const data = loadItems();
    if (!data.lastUpdated) return false;
    const age = Date.now() - new Date(data.lastUpdated).getTime();
    return age < 25 * 60 * 60 * 1000;
}

function getStatus() {
    const data = loadItems();
    const total = data.totalItems || Object.keys(data.items || {}).length;
    return {
        totalItems: total,
        lastUpdated: data.lastUpdated || null,
        available: data.lastUpdated ? (Date.now() - new Date(data.lastUpdated).getTime() < 25 * 60 * 60 * 1000) : false,
        resumeFrom: 0,
        totalCount: total,
        complete: total > 0,
        running,
    };
}

function getRunning() {
    return running;
}

function getProgress() {
    return { ...progress, running };
}

module.exports = { fetchAllItems, getPrice, isAvailable, getStatus, loadItems, getRunning, getProgress };
