const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function startBot() {
  const bot = spawn('node', ['src/index.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  bot.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  bot.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  bot.on('close', (code) => {
    console.log(`\nBot ukončen (kód: ${code}). Restartuji za 3s...`);
    setTimeout(startBot, 3000);
  });

  return bot;
}

const mainBot = startBot();

process.on('SIGINT', () => { mainBot.kill(); process.exit(); });
process.on('SIGTERM', () => { mainBot.kill(); process.exit(); });
