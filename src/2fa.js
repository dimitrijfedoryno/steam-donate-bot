require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const SteamTotpRaw = require('steam-totp');
const SteamTotp = SteamTotpRaw.default || SteamTotpRaw;

const secret = process.env.STEAM_SHARED_SECRET || process.env.STEAM_SHARED_SECRET_1;

if (!secret) {
    console.error('--- CHYBA ---');
    console.error('V .env nebyl nalezen STEAM_SHARED_SECRET ani STEAM_SHARED_SECRET_1!');
    console.error('Nejprve nastav 2FA: node src/setup-2fa.js');
    process.exit(1);
}

try {
    const code = SteamTotp.generateAuthCode(secret);
    console.log('----------------------------');
    console.log(`Tvůj Steam kód: ${code}`);
    console.log('----------------------------');
    console.log(`Čas: ${new Date().toLocaleTimeString()}`);
} catch (err) {
    console.error('Chyba:', err.message);
}
