const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.resolve(__dirname, '..', 'logs', 'settings.json');

const DEFAULTS = {
    webhook_url: '',
    min_donation_value: 0,
    donation_goal: 0,
    alert_duration: 8,
    alert_sound: 'sounds/trade.mp3',
    alert_primary_color: '#a4d007',
    alert_secondary_color: '#ffcc00',
    alert_font_family: "'Arial Black', sans-serif",
    admin_notify_sound: 'sounds/notification.mp3',
    steam_rich_presence: true,
};

function load() {
    try {
        const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
        return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULTS };
    }
}

function save(partial) {
    const current = load();
    const merged = { ...current, ...partial };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
}

module.exports = { load, save, SETTINGS_FILE, DEFAULTS };
