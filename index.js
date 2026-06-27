const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = __dirname;
const { loadStats, formatValue } = require('./src/stats');

const STATUS_FILE = path.join(ROOT, 'logs', 'bot.running');
const LOG_DIR = path.join(ROOT, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const TOP_H = 8;
const BOT_H = 5;

let botProcess = null;
let confirmProcess = null;
let botLogLines = [];
let drawTimer = null;
let foregroundRunning = false;
let awaitingKey = false;

function rows() { return Math.max(TOP_H + BOT_H + 2, process.stdout.rows || 30); }
function cols() { return process.stdout.columns || 80; }

function isRunning(proc) {
    return proc !== null && proc.exitCode === null;
}

function checkBotRunning() {
    try {
        if (!fs.existsSync(STATUS_FILE)) return false;
        return (Date.now() - fs.statSync(STATUS_FILE).mtimeMs) < 10000;
    } catch { return false; }
}

function addLog(line) {
    const R = rows();
    const maxLog = R - TOP_H - BOT_H;
    botLogLines.push(line);
    while (botLogLines.length > maxLog * 2) botLogLines.shift();
}

function draw() {
    const R = rows();
    const C = cols();
    const L = '='.repeat(C);
    const stats = loadStats();
    const online = (isRunning(botProcess) || checkBotRunning()) && !foregroundRunning;
    const maxLog = Math.max(1, R - TOP_H - BOT_H);

    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);

    // === TOP STATUS BAR ===
    console.log(L);
    console.log(` Status:          ${online ? 'ONLINE' : 'OFFLINE'}`);
    console.log(` Nabídek:         ${stats.offers_total}`);
    console.log(` Itemů:           ${stats.items_total}`);
    console.log(` Hodnota:         $${formatValue(stats.value_total)}`);
    console.log(` Největší donor:  ${stats.biggest_donor_name || '---'}${stats.biggest_donor_value ? ' ($' + formatValue(stats.biggest_donor_value) + ')' : ''}`);
    console.log(L);

    // === LOG AREA ===
    const logStart = Math.max(0, botLogLines.length - maxLog);
    for (let i = logStart; i < botLogLines.length; i++) {
        let line = botLogLines[i];
        if (line.length > C) line = line.substring(0, C - 3) + '...';
        console.log(line);
    }

    // Fill remaining middle space
    const used = TOP_H + Math.min(maxLog, botLogLines.length);
    for (let i = used; i < R - BOT_H; i++) {
        console.log('');
    }

    // === BOTTOM MENU ===
    console.log(L);
    console.log('  [1] Start/Stop bot     [2] Start/Stop confirm');
    console.log('  [3] 2FA kód            [4] Nastavit 2FA');
    console.log('  [5] Test dar           [0] Konec');
    process.stdout.write(' VYBER: ');
}

function scheduleRedraw() {
    setImmediate(draw);
}

function spawnBg(script, onExit) {
    const child = spawn('node', [script], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], shell: true });
    child.stdout.on('data', (data) => {
        for (const line of data.toString().trim().split('\n')) {
            if (line) { addLog(line); scheduleRedraw(); }
        }
    });
    child.stderr.on('data', (data) => {
        for (const line of data.toString().trim().split('\n')) {
            if (line) { addLog('! ' + line); scheduleRedraw(); }
        }
    });
    child.on('close', () => {
        addLog(`[${path.basename(script, '.js')}] skončil`);
        try { fs.unlinkSync(STATUS_FILE); } catch {}
        if (onExit) onExit();
        scheduleRedraw();
    });
    return child;
}

function runFg(script) {
    foregroundRunning = true;
    clearInterval(drawTimer);
    process.stdin.setRawMode(false);
    readline.cursorTo(process.stdout, 0, 0);
    readline.clearScreenDown(process.stdout);
    process.stdout.write(`--- ${path.basename(script, '.js')} ---\n`);
    const child = spawn('node', [script], { cwd: ROOT, stdio: 'inherit', shell: true });
    child.on('close', () => {
        process.stdin.setRawMode(true);
        process.stdout.write('\n\nStiskni libovolnou klávesu pro návrat do menu...\n');
        foregroundRunning = false;
        awaitingKey = true;
        drawTimer = setInterval(draw, 3000);
    });
}

function runInteractive() {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    draw();
    drawTimer = setInterval(draw, 3000);

    function handleKeypress(str, key) {
        if (foregroundRunning) return;
        if (!key || !key.name) return;

        // Po skončení foreground scriptu čekáme na libovolnou klávesu
        if (awaitingKey) {
            awaitingKey = false;
            draw();
            return;
        }

        const k = key.name;

        if (k === '0' || (key.ctrl && k === 'c')) {
            if (isRunning(botProcess)) { botProcess.kill(); botProcess = null; }
            if (isRunning(confirmProcess)) { confirmProcess.kill(); confirmProcess = null; }
            clearInterval(drawTimer);
            process.stdin.setRawMode(false);
            process.stdin.removeAllListeners('keypress');
            process.stdin.pause();
            readline.cursorTo(process.stdout, 0, rows() - 1);
            readline.clearScreenDown(process.stdout);
            process.stdout.write('Konec.\n');
            process.exit();
        }

        if (k === '1') {
            if (isRunning(botProcess)) {
                addLog('Zastavuji bota...'); scheduleRedraw();
                botProcess.kill(); botProcess = null;
            } else {
                addLog('Spouštím bota...'); scheduleRedraw();
                botProcess = spawnBg('src/index.js', () => { botProcess = null; });
            }
            return;
        }

        if (k === '2') {
            if (isRunning(confirmProcess)) {
                addLog('Zastavuji confirm...'); scheduleRedraw();
                confirmProcess.kill(); confirmProcess = null;
            } else {
                addLog('Spouštím confirm...'); scheduleRedraw();
                confirmProcess = spawnBg('src/confirm.js', () => { confirmProcess = null; });
            }
            return;
        }

        if (k === '3') runFg('src/2fa.js');
        if (k === '4') runFg('src/setup-2fa.js');
        if (k === '5') runFg('src/test-offer.js');
    }

    process.stdin.on('keypress', handleKeypress);
}

if (process.stdin.isTTY) {
    runInteractive();
} else {
    console.log('Terminal nepodporuje raw mod, pouzivam zjednoduseny rezim.\n');
    // simple mode
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    (async () => {
        draw();
        while (true) {
            const answer = await new Promise((r) => rl.question('', r));
            if (answer === '0') {
                if (isRunning(botProcess)) botProcess.kill();
                if (isRunning(confirmProcess)) confirmProcess.kill();
                console.log('Konec.'); rl.close(); return;
            }
            if (answer === '1') {
                if (isRunning(botProcess)) { addLog('Zastavuji bota...'); botProcess.kill(); botProcess = null; }
                else { addLog('Spouštím bota...'); botProcess = spawnBg('src/index.js', () => { botProcess = null; }); }
                draw(); continue;
            }
            if (answer === '2') {
                if (isRunning(confirmProcess)) { addLog('Zastavuji confirm...'); confirmProcess.kill(); confirmProcess = null; }
                else { addLog('Spouštím confirm...'); confirmProcess = spawnBg('src/confirm.js', () => { confirmProcess = null; }); }
                draw(); continue;
            }
            if (['3', '4', '5'].includes(answer)) {
                const scripts = { '3': 'src/2fa.js', '4': 'src/setup-2fa.js', '5': 'src/test-offer.js' };
                await new Promise((r) => { const c = spawn('node', [scripts[answer]], { cwd: ROOT, stdio: 'inherit', shell: true }); c.on('close', r); });
                await new Promise((r) => rl.question('\nStiskni Enter pro návrat do menu...', r));
                draw(); continue;
            }
        }
    })();
}
