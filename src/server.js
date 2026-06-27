const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.css': 'text/css',
    '.js': 'application/javascript',
};

function startServer(port, testTriggerFile) {
    const ROOT = path.resolve(__dirname, '..');

    function sendFile(res, filePath) {
        const ext = path.extname(filePath);
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
            res.end(data);
        });
    }

    function tryListen(currentPort) {
        const server = http.createServer((req, res) => {
            const url = new URL(req.url, `http://localhost:${currentPort}`);
            let p = url.pathname;

            res.setHeader('Access-Control-Allow-Origin', '*');

            if (p === '/test-offer' && testTriggerFile) {
                const fakeDonors = [
                    { name: 'StreamFan99', items: ['AK-47 | Slate (Field-Tested)', 'Clutch Case', 'Gamma Case'] },
                    { name: 'SkinLoverCZ', items: ['AK-47 | Redline (Field-Tested)', 'Dreams & Nightmares Case'] },
                    { name: 'CS2Player_X', items: ['AWP | Atheris (Field-Tested)'] },
                    { name: 'DonatorKing', items: ['M4A1-S | Hyper Beast (Minimal Wear)', 'Prisma Case', 'Fracture Case', 'Snakebite Case'] },
                    { name: 'Prispevator123', items: ['USP-S | Kill Confirmed (Field-Tested)', 'Clutch Case'] },
                ];
                const donor = fakeDonors[Math.floor(Math.random() * fakeDonors.length)];
                const triggerData = { username: donor.name, items: donor.items, processed: false };
                fs.writeFileSync(testTriggerFile, JSON.stringify(triggerData, null, 2), 'utf8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', donor: donor.name }));
                return;
            }

            if (p === '/') p = '/alert.html';

            const filePath = path.join(ROOT, p);
            if (!filePath.startsWith(ROOT)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }

            sendFile(res, filePath);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE' && currentPort < port + 10) {
                console.log(`Port ${currentPort} je obsazený, zkouším ${currentPort + 1}...`);
                server.close(() => tryListen(currentPort + 1));
            } else {
                console.error(`Port ${currentPort} - ${err.message}`);
            }
        });

        server.listen(currentPort, () => {
            console.log(`\n=== HTTP Server ===`);
            console.log(`Port: ${currentPort}`);
            console.log(`OBS: http://localhost:${currentPort}/alert.html`);
            console.log(`Test: http://localhost:${currentPort}/test-offer`);
            console.log(`===================\n`);
        });

        return server;
    }

    return tryListen(port);
}

module.exports = { startServer };

// Při samostatném spuštění (node src/server.js)
if (require.main === module) {
    require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
    const testTriggerFile = path.resolve(__dirname, '..', 'logs', '_test_trigger.json');
    startServer(process.env.STEAM_WEB_PORT || 3000, testTriggerFile);
}
