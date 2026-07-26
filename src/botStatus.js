const statuses = new Map();

function setOnline(index, username, personaName) {
    statuses.set(index, {
        username,
        personaName: personaName || username,
        online: true,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        steamLevel: 0,
        donationCount: 0,
        error: null,
        reconnecting: false,
    });
}

function setPersonaName(index, personaName) {
    const cur = statuses.get(index);
    if (cur) cur.personaName = personaName;
}

function setOffline(index, error = null) {
    const cur = statuses.get(index);
    if (cur) {
        cur.online = false;
        cur.lastActivity = Date.now();
        cur.error = error;
        cur.reconnecting = false;
    }
}

function setReconnecting(index) {
    const cur = statuses.get(index);
    if (cur) {
        cur.online = true;
        cur.reconnecting = true;
        cur.error = 'Reconnecting...';
    }
}

function setSteamLevel(index, level) {
    const cur = statuses.get(index);
    if (cur) cur.steamLevel = level;
}

function bumpActivity(index) {
    const cur = statuses.get(index);
    if (cur) {
        cur.lastActivity = Date.now();
        cur.donationCount = (cur.donationCount || 0) + 1;
    }
}

function getAll() {
    return Array.from(statuses.entries()).map(([index, data]) => ({ index, ...data }));
}

module.exports = { setOnline, setOffline, setReconnecting, setSteamLevel, bumpActivity, getAll, setPersonaName };
