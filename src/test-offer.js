const fs = require('fs');
const path = require('path');

const TEST_TRIGGER_FILE = path.join(__dirname, '..', 'logs', '_test_trigger.json');

const fakeDonors = [
    { name: 'StreamFan99', items: ['AK-47 | Slate (Field-Tested)', 'Clutch Case', 'Gamma Case'] },
    { name: 'SkinLoverCZ', items: ['AK-47 | Redline (Field-Tested)', 'Dreams & Nightmares Case'] },
    { name: 'CS2Player_X', items: ['AWP | Atheris (Field-Tested)'] },
    { name: 'DonatorKing', items: ['M4A1-S | Hyper Beast (Minimal Wear)', 'Prisma Case', 'Fracture Case', 'Snakebite Case'] },
    { name: 'Prispevator123', items: ['USP-S | Kill Confirmed (Field-Tested)', 'Clutch Case'] },
];

const donor = fakeDonors[Math.floor(Math.random() * fakeDonors.length)];

const triggerData = {
    username: donor.name,
    items: donor.items,
    processed: false
};

fs.writeFileSync(TEST_TRIGGER_FILE, JSON.stringify(triggerData, null, 2), 'utf8');

console.log(`--- Testovací dar odeslán do bota ---`);
console.log(`Uživatel: ${donor.name}`);
console.log(`Předměty: ${donor.items.join(', ')}`);
console.log('------------------------------------');
console.log('Bot (src/bot.js) musí běžet - zpracuje trigger a pošle alert do alert.html');
