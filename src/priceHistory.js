const fs = require('fs');
const path = require('path');

const PRICE_FILE = path.join(__dirname, '..', 'logs', 'price_history.json');

function load() {
    try {
        if (!fs.existsSync(PRICE_FILE)) return {};
        return JSON.parse(fs.readFileSync(PRICE_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function save(cacheMap) {
    const data = {
        lastSaved: new Date().toISOString(),
        items: {},
    };
    for (const [name, price] of cacheMap) {
        if (price > 0) data.items[name] = price;
    }
    const dir = path.dirname(PRICE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PRICE_FILE, JSON.stringify(data, null, 2), 'utf8');
    return data;
}

function loadIntoMap(targetMap) {
    const data = load();
    if (data.items) {
        for (const [name, price] of Object.entries(data.items)) {
            if (!targetMap.has(name) && price > 0) {
                targetMap.set(name, price);
            }
        }
    }
    return { count: Object.keys(data.items || {}).length, lastSaved: data.lastSaved || null };
}

module.exports = { load, save, loadIntoMap };
