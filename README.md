# Steam Stream Donate Bot

Bot pro streamery, který automaticky přijímá dary ve formě CS2 skinů přes Steam trade offrry. Obsahuje OBS overlay pro zobrazení notifikací o darech na streamu.

## Struktura projektu

```
index.js                # Menu - spouští všechny scripty, zobrazuje statistiky
src/
├── index.js            # Bot - server + přihlášení všech účtů
├── account.js          # Třída pro jeden Steam účet
├── server.js           # HTTP server pro OBS overlay
├── stats.js            # Statistiky (offrry, itemy, hodnoty)
├── prices.js           # Zjištění ceny skinů z API
├── confirm.js          # Auto-confirmace mobilních tradeů
├── 2fa.js              # Vygeneruje 2FA kód
├── setup-2fa.js        # Interaktivní nastavení 2FA
└── test-offer.js       # Testovací dar
sounds/trade.mp3        # Zvuk pro OBS
alert.html              # OBS overlay
.env                    # Konfigurace
logs/                   # Logy, statistiky, alert data
```

## Požadavky

- Node.js 18+
- Steam účet s [telefonním číslem](https://steamcommunity.com/edit/settings) (pro 2FA)
- Steam Web API klíč (volitelný) - https://steamcommunity.com/dev/apikey

## Instalace

```bash
npm install
```

## Nastavení 2FA (první spuštění)

```bash
node src/setup-2fa.js
```

Postup:
1. Skript se zeptá na přihlašovací údaje (nebo je převezme z .env)
2. Pokud účet nemá 2FA, aktivuje ji
3. Pokud vyžaduje e-mailový kód, zadej ho
4. shared_secret a identity_secret se automaticky uloží do .env
5. Skript vygeneruje testovací 2FA kód pro ověření

> **Proč 2FA místo .env?** shared_secret slouží jako druhý faktor - bez něj nelze generovat přihlašovací kódy. I kdyby někdo získal .env s heslem, bez shared_secret se nepřihlásí. 2FA kód se generuje dynamicky a mění se každých 30 sekund.

## Spuštění

```bash
# Hlavní menu (doporučeno)
node index.js
```

Menu zobrazuje statistiky a umožňuje:
- **1** - Start/Stop bota (přijímání darů + OBS server)
- **2** - Start/Stop auto-confirmace
- **3** - Vygenerovat 2FA kód
- **4** - Nastavit 2FA pro nový účet
- **5** - Odeslat testovací dar (otestuje OBS overlay)

Nebo přímo:
```bash
node src/index.js        # Bot bez menu
node src/server.js       # Jen HTTP server
node src/confirm.js      # Jen auto-confirmace
```

V OBS přidej Browser Source s URL: `http://localhost:3000/alert.html`

### Testování bez reálného daru

```bash
node src/test-offer.js   # Přes trigger soubor (bot musí běžet)
# Nebo otevři: http://localhost:3000/test-offer (server musí běžet)
```

## OBS integrace

1. Spusť `node src/server.js`
2. V OBS přidej **Browser Source**
3. URL: `http://localhost:3000/alert.html`
4. Šířka/Výška: dle potřeby (např. 800x400)
5. Pro zvuk: povol "Control audio via OBS"

Bot zapisuje data do `logs/alert_data.json` - HTML overlay toto JSON každou sekundu kontroluje a při změně zobrazí animovanou notifikaci.

> **Nepoužívej `file://`** - prohlížeč blokuje fetch requesty kvůli CORS. Server řeší vše včetně audia.

## Proměnné prostředí (.env)

| Proměnná | Popis |
|---|---|
| `STEAM_USERNAME` | Uživatelské jméno Steam účtu |
| `STEAM_PASSWORD` | Heslo Steam účtu |
| `STEAM_SHARED_SECRET` | Tajný klíč pro generování 2FA kódů |
| `STEAM_IDENTITY_SECRET` | Tajný klíč pro potvrzování tradeů |
| `STEAM_WEBAPI_TOKEN` | Steam Web API klíč (volitelný) |
| `STEAM_WEB_PORT` | Port pro HTTP server (výchozí 3000) |

Pro více účtů použij číslované proměnné: `STEAM_USERNAME_2`, `STEAM_PASSWORD_2`, atd.

## Bezpečnost

- `.env` obsahuje citlivé údaje - NIKDY ho nesdílej ani necommituj
- Pro roboty používej samostatný Steam účet (ne hlavní)
- shared_secret a identity_secret jsou bezpečnější než heslo - bez nich se nelze přihlásit
