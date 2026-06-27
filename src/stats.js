const fs = require('fs');
const path = require('path');

const STATS_FILE = path.resolve(__dirname, '..', 'logs', 'stats.json');

function defaultStats() {
    return { offers_total: 0, items_total: 0, value_total: 0, biggest_donor_name: '', biggest_donor_steamid: '', biggest_donor_value: 0 };
}

function loadStats() {
    try {
        if (!fs.existsSync(STATS_FILE)) return defaultStats();
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    } catch { return defaultStats(); }
}

function saveStats(stats) {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
}

function recordOffer(steamName, steamID, items, totalValue) {
    const stats = loadStats();
    stats.offers_total++;
    stats.items_total += items.length;
    stats.value_total = Math.round((stats.value_total + totalValue) * 100) / 100;
    if (totalValue > stats.biggest_donor_value) {
        stats.biggest_donor_name = steamName;
        stats.biggest_donor_steamid = steamID;
        stats.biggest_donor_value = Math.round(totalValue * 100) / 100;
    }
    saveStats(stats);
}

function formatValue(val) { return val.toFixed(2); }

module.exports = { loadStats, saveStats, recordOffer, defaultStats, formatValue };
