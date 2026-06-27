const https = require('https');
const http = require('http');

function send(url, data) {
    return new Promise((resolve, reject) => {
        if (!url) return resolve(null);

        const embed = {
            title: '🎮 Nový dar!',
            color: 0xa4d007,
            fields: [
                { name: 'Uživatel', value: data.username, inline: true },
                { name: 'Částka', value: `$${data.total}`, inline: true },
                { name: 'Nejdražší item', value: data.topItem || 'Neznámý', inline: false },
            ],
            timestamp: new Date().toISOString(),
        };

        const body = JSON.stringify({ embeds: [embed] });
        const mod = url.startsWith('https') ? https : http;

        const u = new URL(url);
        const options = {
            hostname: u.hostname,
            port: u.port || (url.startsWith('https') ? 443 : 80),
            path: u.pathname + u.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = mod.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = { send };
