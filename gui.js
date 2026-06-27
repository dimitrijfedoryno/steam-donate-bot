const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

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
  console.log(`\nBot ukončen (kód: ${code})`);
  process.exit(code);
});

process.on('SIGINT', () => { bot.kill(); process.exit(); });
process.on('SIGTERM', () => { bot.kill(); process.exit(); });
