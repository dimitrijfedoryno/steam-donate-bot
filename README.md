# 🎮 Steam Stream Donate Bot

Bot pro streamery, který automaticky přijímá dary ve formě CS2 skinů přes Steam trade offery. Obsahuje webový admin panel, OBS overlay pro notifikace na streamu, správu inventáře a mnoho dalšího.

---

## ✨ Funkce

### 🤖 Přijímání darů
- Automatické přijímání CS2 skinů přes Steam trade offery
- Podpora více Steam účtů současně
- Automatická 2FA potvrzení obchodů (mobile authenticator)
- Podpora webhooků (Discord) pro oznámení o darech
- Zvukové notifikace přímo v OBS overlayi

### 📊 Admin Panel (webové rozhraní)
- **Dashboard** — přehled online statusu, poslední dary, celková hodnota, market katalog
- **Historie darů** — kompletní přehled všech přijatých darů s vyhledáváním a řazením
- **Statistiky** — grafy darů v čase (denní/týdenní/měsíční), největší dárce, nejčastější předměty
- **Správa účtů** — přidávání/odebírání Steam účtů, generování 2FA, testování darů
- **Konzole** — živý výstup logů bota přímo v prohlížeči
- **Obchody** — přehled aktivních i historických trade nabídek, přijmutí/odmítnutí, klikatelné profily na Steam
- **Inventář** — zobrazení kompletního CS2 inventáře bota s rozlišením trade locků
- **Donation Goal** — nastavení cíle sbírky (např. na nový mikrofon)
- **Leaderboard** — žebříček největších dárců
- **Nastavení Alertu** — konfigurace vzhledu a chování notifikací
- **Aktualizace** — automatické stahování aktualizací přes git

### 🔒 Inventář & Trade Lock
- Zobrazení celého CS2 inventáře bota (včetně netradovatelných položek)
- **Oranžový zámek** ⏰ — dočasný trade hold (zbývající čas např. "5d 12h")
- **Šedý zámek** 🔒 — trvale neobchodovatelný předmět
- Parsování `owner_descriptions` pro přesné datum uvolnění
- automatické načítání cen z market katalogu

### 💰 Cenový engine
- Načítání cen z **csgomarket.com API** (~27 000 předmětů za ~200ms)
- Denní automatická aktualizace katalogu cen
- Priorita cen: tržní katalog → Steam priceoverride API → cache na disku
- Persistní cenová cache (`price_history.json`) přežívá restarty

### 🖥️ OBS Overlay
- Animované notifikace o darech přímo na streamu
- Zobrazuje jméno dárce, položku, hodnotu a ikonku předmětu
- Podpora zvukových notifikací
- automatické propojení na Steam profil dárce

### 👥 Správa více účtů
- Podpora neomezeného počtu Steam účtů (STEAM_USERNAME_1, _2, _3...)
- Nezávislé přihlášení každého účtu
- Auto-reconnect při výpadku připojení

### 📦 Docker podpora
- Plně Dockerizovaný — připraveno pro OMV / Portainer na RPi5
- `docker-compose.yml` připraveno k použití
- Trvalé uložení dat přes volume mounty

---

## 📁 Struktura projektu

```
├── index.js                  # Entry point — menu, spouštění bota + serveru
├── alert.html                # OBS overlay (browser source)
├── .env                      # Konfigurace (Steam údaje, port, webhooks)
├── Dockerfile                # Docker image pro RPi5 / OMV
├── docker-compose.yml        # Docker Compose konfigurace
├── src/
│   ├── index.js              # Bot logika — přihlášení, přijímání darů
│   ├── account.js            # Třída AccountBot — jeden Steam účet + 2FA
│   ├── server.js             # HTTP server (admin panel + API + overlay)
│   ├── prices.js             # Cenový engine + market katalog
│   ├── priceHistory.js       # Persistní cenová cache
│   ├── fetchMarketItems.js   # Stahování katalogu z csgomarket.com
│   ├── stats.js              # Statistiky (offery, itemy, hodnoty)
│   ├── botStatus.js          # Online/offline status všech botů
│   ├── confirm.js            # Auto-confirmace mobilních tradeů
│   ├── 2fa.js                # Vygeneruje 2FA kód
│   ├── setup-2fa.js          # Interaktivní nastavení 2FA
│   ├── test-offer.js         # Testovací dar přes trigger soubor
│   └── menu.js               # Konzolové menu
├── admin/
│   ├── src/
│   │   ├── App.jsx           # React router + navigace
│   │   ├── api.js            # API klient pro všechny endpointy
│   │   └── components/
│   │       ├── Dashboard.jsx     # Přehled, katalog, poslední dary
│   │       ├── DonationHistory.jsx  # Historie darů
│   │       ├── Statistics.jsx   # Grafy a statistiky
│   │       ├── Accounts.jsx     # Správa účtů + 2FA
│   │       ├── Console.jsx      # Živé logy
│   │       ├── TradeOffers.jsx  # Přehled obchodů
│   │       ├── Inventory.jsx    # CS2 inventář s trade locky
│   │       ├── DonationGoal.jsx # Cíl sbírky
│   │       ├── Leaderboard.jsx  # Žebříček dárců
│   │       ├── AlertSettings.jsx # Nastavení alertů
│   │       └── Update.jsx       # Automatické aktualizace
│   └── dist/                     # Buildnutý SPA (produkce)
├── sounds/
│   ├── notification.mp3          # Zvuk notifikace
│   └── trade.mp3                 # Zvuk obchodu
├── logs/
│   ├── trades.json               # Historie obchodů
│   ├── price_history.json        # Cache cen
│   ├── market_items.json         # Katalog předmětů
│   ├── alert_queue.json          fronta alertů
│   └── alert_data.json           # Aktuální alert pro overlay
└── scripts/
    └── fetch-all.js              # Ruční stažení katalogu
```

---

## 📋 Požadavky

- **Node.js 18+** (doporučeno 20)
- **Steam účet** s [telefonním číslem](https://steamcommunity.com/edit/settings) (pro 2FA)
- **Docker** (volitelné — pro nasazení na RPi5 / OMV)

---

## ⚙️ Instalace

### Manuální (Windows / Linux)

```bash
# 1. Nainstaluj závislosti
npm install
cd admin && npm install && npm run build && cd ..

# 2. Nakonfiguruj .env
# Zkopíruj .env.example a vyplň Steam údaje

# 3. Nastav 2FA (první spuštění)
node src/setup-2fa.js

# 4. Spusť bota
node src/gui.js
```

### 🐳 Docker (RPi5 / OMV)

```bash
# 1. Naklonuj repo / zkopíruj soubory na RPi5
# 2. Uprav .env s tvými Steam údaji
# 3. Sestav a spusť
docker compose up -d --build
```

V OMV: **Docker → Compose → Add** → vyber `docker-compose.yml` → Deploy.

---

## 🚀 Spuštění

```bash
# Doporučeno — s auto-restartem
node src/gui.js

# Přímo (bez auto-restartu)
node src/index.js
```

| Příkaz | Popis |
|---|---|
| `node src/gui.js` | Spustí bota s automatickým restartem při pádu |
| `node src/index.js` | Spustí bota (bez auto-restartu) |
| `node src/setup-2fa.js` | Nastavení 2FA pro nový účet |
| `node src/test-offer.js` | Odeslat testovací dar |

---

## 🖥️ OBS Integrace

1. Spusť bota (`node src/gui.js`)
2. V OBS přidej **Browser Source**
3. URL: `http://localhost:3000/alert.html`
4. Šířka/Výška: dle potřeby (např. 800×400)
5. Povol **"Control audio via OBS"** pro zvukové notifikace

> ⚠️ **Nepoužívej `file://`** — prohlížeč blokuje fetch requesty kvůli CORS. Vždy přes HTTP server.

---

## 🔑 Proměnné prostředí (.env)

| Proměnná | Povinné | Popis |
|---|---|---|
| `STEAM_USERNAME` | ✅ | Uživatelské jméno Steam účtu |
| `STEAM_PASSWORD` | ✅ | Heslo Steam účtu |
| `STEAM_SHARED_SECRET` | ✅ | Tajný klíč pro generování 2FA kódů |
| `STEAM_IDENTITY_SECRET` | ✅ | Tajný klíč pro potvrzování tradeů |
| `STEAM_WEB_PORT` | ❌ | Port HTTP serveru (výchozí: `3000`) |
| `STEAM_WEBHOOK_URL` | ❌ | Discord webhook URL pro oznámení |

### 🔄 Více účtů

Pro každý další účet přidej číslované proměnné:

```env
STEAM_USERNAME_1=bot_account_1
STEAM_PASSWORD_1=heslo1
STEAM_SHARED_SECRET_1=secret1
STEAM_IDENTITY_SECRET_1=identity1

STEAM_USERNAME_2=bot_account_2
STEAM_PASSWORD_2=heslo2
STEAM_SHARED_SECRET_2=secret2
STEAM_IDENTITY_SECRET_2=identity2
```

---

## 🔒 Bezpečnost

- 🚫 `.env` obsahuje citlivé údaje — **NIKDY ho nesdílej ani necommituj**
- 🤖 Pro bota používej **samostatný Steam účet** (ne hlavní)
- 🔐 `shared_secret` a `identity_secret` jsou bezpečnější než heslo — bez nich se nelze přihlásit
- 🐳 V Dockeru je `.soubor` mountován jako read-only (`:ro`)

---

## 🐳 Nasazení na RPi5 (OMV)

1. Nainstaluj Docker přes **OMV → Plugins → openmediavault-docker**
2. Zkopíruj projekt na disk (`/srv/dev-disk-by-uuid-xxx/steam-bot/`)
3. Uprav `.env` s tvými údaji
4. V OMV → **Docker → Compose** → vytvoř nový stack s `docker-compose.yml`
5. Klikni **Deploy** — bot se sestaví a spustí
6. Admin panel: `http://<IP_RPi5>:3000`
7. OBS overlay: `http://<IP_RPi5>:3000/alert.html`

Data se ukládají do `logs/` přes volume mount — přežijí restarty a aktualizace kontejneru.

---

## 🛠️ API Endpoints

| Endpoint | Metoda | Popis |
|---|---|---|
| `/api/status` | GET | Online status bota |
| `/api/bots/status` | GET | Status všech botů |
| `/api/stats` | GET | Statistiky darů |
| `/api/history` | GET | Historie darů |
| `/api/trades` | GET/POST | Přehled a správa obchodů |
| `/api/inventory` | POST | CS2 inventář bota |
| `/api/prices/status` | GET | Stav cenového katalogu |
| `/api/prices/refresh` | POST | Aktualizace katalogu |
| `/api/accounts` | GET/POST/PUT/DELETE | Správa účtů |
| `/api/names` | GET | Cache jmen (steamid → nickname) |
| `/api/alert` | GET | Aktuální data pro overlay |
| `/api/test-offer` | GET | Testovací dar |
| `/api/control/bot-restart` | POST | Restart bota |
| `/api/control/confirm` | GET/POST | Auto-confirmace |
| `/api/leaderboard` | GET | Žebříček dárců |
| `/api/history/csv` | GET | Export historie do CSV |
