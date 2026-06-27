const readline = require('readline');
const fs = require('fs');
const path = require('path');
const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise((r) => rl.question(q, r));

const ENV_PATH = path.resolve(__dirname, '..', '.env');

function parseEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    for (const line of content.split('\n')) {
        const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
        if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
    return env;
}

function writeEnv(filePath, updates) {
    let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
    for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${key}=${value}`);
        } else {
            content += (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
        }
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

function envVal(env, names) {
    for (const n of names) { if (env[n]) return env[n]; }
    return null;
}

async function main() {
    console.log('=== Steam 2FA Setup ===\n');

    let env = parseEnv(ENV_PATH);
    const username = process.argv[2] || envVal(env, ['STEAM_USERNAME', 'STEAM_USERNAME_1']) || await question('Steam username: ');
    const password = process.argv[3] || envVal(env, ['STEAM_PASSWORD', 'STEAM_PASSWORD_1']) || await question('Steam password: ');

    const existingSecret = envVal(env, ['STEAM_SHARED_SECRET', 'STEAM_SHARED_SECRET_1']);
    const existingIdentity = envVal(env, ['STEAM_IDENTITY_SECRET', 'STEAM_IDENTITY_SECRET_1']);

    if (existingSecret && existingIdentity) {
        console.log('\n2FA je již nastavena:');
        console.log(`  shared_secret:   ${existingSecret}`);
        console.log(`  identity_secret: ${existingIdentity}`);
        const code = SteamTotp.generateAuthCode(existingSecret);
        console.log(`  Aktuální kód:    ${code}`);
        const reuse = await question('\nChceš použít stávající 2FA? (a/n): ');
        if (reuse.toLowerCase() === 'a') {
            console.log('Hotovo.');
            rl.close();
            return;
        }
    }

    const client = new SteamUser();
    const community = new SteamCommunity();

    console.log(`\nPřihlašuji se jako ${username}...`);

    client.on('error', (err) => {
        console.error(`\nChyba: ${err.message}`);
        if (err.message.includes('SteamGuard')) console.log('=> Vyžadován e-mailový kód.');
        if (err.message.includes('2FA')) console.log('=> Účet již má 2FA. shared_secret přidej ručně do .env.');
        process.exit(1);
    });

    client.on('steamGuard', async (domain, callback, lastCodeWrong) => {
        console.log(`Kód odeslán na ${domain}`);
        const code = await question('Zadej kód z e-mailu: ');
        callback(code);
    });

    const logonDetails = { accountName: username, password };
    if (existingSecret) {
        logonDetails.twoFactorCode = SteamTotp.generateAuthCode(existingSecret);
    }
    client.logOn(logonDetails);

    await new Promise((resolve, reject) => {
        client.once('loggedOn', () => { console.log('Přihlášeno.'); resolve(); });
        setTimeout(() => reject(new Error('Timeout')), 30000);
    });

    client.on('webSession', (sessionID, cookies) => { community.setCookies(cookies); });

    await new Promise((resolve, reject) => {
        client.once('webSession', () => { console.log('Web relace OK.'); resolve(); });
        setTimeout(() => reject(new Error('Timeout web')), 15000);
    });

    if (existingSecret && existingIdentity) {
        console.log('\nUkládám existující 2FA do .env...');
        writeEnv(ENV_PATH, {
            STEAM_USERNAME_1: username,
            STEAM_PASSWORD_1: password,
            STEAM_SHARED_SECRET_1: existingSecret,
            STEAM_IDENTITY_SECRET_1: existingIdentity,
            STEAM_WEBAPI_TOKEN: envVal(env, ['STEAM_WEBAPI_TOKEN', 'STEAMWEBAPI_TOKEN']) || ''
        });
        console.log('Hotovo!');
        rl.close();
        return;
    }

    console.log('\nAktivuji mobilní 2FA (vyžaduje telefon na účtu)...');
    community.enableTwoFactor((err, response) => {
        if (err) {
            console.error(`\nChyba: ${err.message}`);
            if (err.message.includes('phone')) {
                console.log('=> Přidej telefon: https://steamcommunity.com/edit/settings');
            }
            rl.close();
            process.exit(1);
            return;
        }

        if (response.success) {
            console.log('\n=== 2FA AKTIVOVÁNA ===');
            console.log(`  shared_secret:    ${response.shared_secret}`);
            console.log(`  identity_secret:  ${response.identity_secret}`);
            console.log(`  revocation_code:  ${response.revocation_code}`);

            writeEnv(ENV_PATH, {
                STEAM_USERNAME_1: username,
                STEAM_PASSWORD_1: password,
                STEAM_SHARED_SECRET_1: response.shared_secret,
                STEAM_IDENTITY_SECRET_1: response.identity_secret,
                STEAM_WEBAPI_TOKEN: envVal(env, ['STEAM_WEBAPI_TOKEN', 'STEAMWEBAPI_TOKEN']) || ''
            });

            const testCode = SteamTotp.generateAuthCode(response.shared_secret);
            console.log(`\nTest kód: ${testCode}`);
            console.log('=> Údaje uloženy do .env');
            console.log('=> BOT PŘIPRAVEN');
        } else {
            console.log('\n2FA selhala:', JSON.stringify(response));
        }
        rl.close();
    });
}

main().catch((err) => { console.error(err.message); rl.close(); process.exit(1); });
