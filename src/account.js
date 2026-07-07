const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const readline = require('readline');

const SteamTotpRaw = require('steam-totp');
const SteamTotp = SteamTotpRaw.default || SteamTotpRaw;
const { getItemPrice } = require('./prices');
const { recordOffer } = require('./stats');
const alertQueue = require('./alertQueue');
const botStatus = require('./botStatus');
const settingsMod = require('./settings');
const webhook = require('./webhook');

const ICON_BASE = 'https://steamcommunity.com/economy/image/';
const TRADES_FILE = require('path').resolve(__dirname, '..', 'logs', 'trades.json');
const MAX_TRADES = 100;

function loadTrades() {
  try {
    if (require('fs').existsSync(TRADES_FILE)) {
      return JSON.parse(require('fs').readFileSync(TRADES_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function saveTrades(trades) {
  const limited = trades.slice(-MAX_TRADES);
  require('fs').writeFileSync(TRADES_FILE, JSON.stringify(limited, null, 2), 'utf8');
}

class AccountBot {
  static instances = [];

  constructor(config, { logFile, alertFile, alertQueueFile, onReady }) {
    this.name = config.username;
    this.index = config.index;
    this.logFile = logFile;
    this.alertFile = alertFile;
    this.alertQueueFile = alertQueueFile;
    this.onReady = onReady;

    AccountBot.instances.push(this);

    this.client = new SteamUser();
    this.community = new SteamCommunity();
    this.manager = new TradeOfferManager({
      steam: this.client,
      domain: 'localhost',
      language: 'en'
    });

    this.client.accountName = config.username;
    this.client._password = config.password;
    this.client._sharedSecret = config.shared_secret;

    this.client.logOn({
      accountName: config.username,
      password: config.password,
      twoFactorCode: SteamTotp.generateAuthCode(config.shared_secret)
    });

    this._reconnectAttempts = 0;
    this._maxReconnect = 10;
    this._reconnectTimer = null;

    this.client.on('error', (err) => {
      console.log(`[${this.name}] Chyba: ${err.message}`);
      botStatus.setOffline(this.index, err.message);
      this._scheduleReconnect();
    });

    this.client.on('disconnected', (eresult, msg) => {
      console.log(`[${this.name}] Odpojen: ${msg || eresult}`);
      botStatus.setOffline(this.index, msg || `eresult ${eresult}`);
      this._scheduleReconnect();
    });

    this.client.on('steamGuard', (domain, callback, lastCodeWrong) => {
      console.log(`[${this.name}] Steam Guard kód vyžadován (${domain})`);
      botStatus.setOffline(this.index, 'Steam Guard required');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question(`[${this.name}] Zadej Steam Guard kód: `, (code) => {
        rl.close();
        callback(code);
      });
    });

    this.client.on('loggedOn', () => {
      console.log(`[${this.name}] Přihlášen ke Steamu`);
      botStatus.setOnline(this.index, this.name);
      // Nastavit online stav a hru co nejdříve
      try {
        const s = settingsMod.load();
        if (s.steam_rich_presence) {
          this.client.setPersona(SteamUser.EPersonaState.Online);
          this.client.gamesPlayed([730]);
        }
      } catch (e) {
        console.log(`[${this.name}] Chyba nastavení stavu: ${e.message}`);
      }
    });

    this.client.on('webSession', (sessionID, cookies) => {
      this.community.setCookies(cookies);
      this.manager.setCookies(cookies, (err) => {
        if (err) {
          console.log(`[${this.name}] API chyba: ${err.message}`);
          botStatus.setOffline(this.index, err.message);
          return;
        }
        console.log(`[${this.name}] >>> ONLINE A PŘIPRAVEN <<<`);
        botStatus.setOnline(this.index, this.name);
        this.setRichPresence();
        if (this.onReady) this.onReady(this);
      });
    });

    this.manager.on('newOffer', async (offer) => {
      const partnerID = offer.partner.getSteamID64();
      const itemsToGive = (offer.itemsToGive || []).map(this._serializeItem);
      const itemsToReceive = (offer.itemsToReceive || []).map(this._serializeItem);
      const isDonation = itemsToGive.length === 0;

      let partnerName = partnerID;

      if (isDonation) {
        console.log(`[${this.name}] Dar od ${partnerID}, počítám...`);

        this.community.getSteamUser(offer.partner, async (err, user) => {
          const steamName = err ? partnerID : user.name;
          partnerName = steamName;
          let totalValue = 0;
          let mostExpensiveItem = { name: '', price: 0 };

          for (const item of offer.itemsToReceive) {
            const price = await getItemPrice(item.market_hash_name);
            totalValue += price;
            if (price > mostExpensiveItem.price) {
              mostExpensiveItem = { name: item.market_hash_name, price };
            }
          }

          this._saveOffer({ offer, partnerID, partnerName: steamName, itemsToGive, itemsToReceive, isDonation });

          const alertData = {
            username: steamName,
            total: totalValue.toFixed(2),
            topItem: mostExpensiveItem.name || "Neznámý",
            topItemPrice: mostExpensiveItem.price.toFixed(2),
            timestamp: Date.now()
          };

          const s = settingsMod.load();
          if (s.donation_goal > 0) {
            const current = s.donation_current || 0;
            settingsMod.save({ donation_current: current + totalValue });
          }
          if (s.min_donation_value > 0 && totalValue < s.min_donation_value) {
            this._log(`DAR OD: ${steamName} | CELKEM: ${totalValue.toFixed(2)} USD (pod minimem, alert přeskočen)`);
          } else {
            this._writeAlert(alertData);
            if (s.webhook_url) {
              webhook.send(s.webhook_url, alertData).catch(e => console.log(`[${this.name}] Webhook chyba: ${e.message}`));
            }
          }
          botStatus.bumpActivity(this.index);
          this._log(`DAR OD: ${steamName} | CELKEM: ${totalValue.toFixed(2)} USD`);

          offer.accept((acceptErr) => {
            if (acceptErr) {
              console.log(`[${this.name}] Chyba akceptace: ${acceptErr.message}`);
              this._updateOfferState(offer.id, 'declined');
            } else {
              console.log(`[${this.name}] Nabídka přijata! $${totalValue.toFixed(2)}`);
              this._updateOfferState(offer.id, 'accepted');
              recordOffer(steamName, partnerID, offer.itemsToReceive, totalValue);
            }
          });
        });
      } else {
        this.community.getSteamUser(offer.partner, (err, user) => {
          const steamName = err ? partnerID : user.name;
          partnerName = steamName;
          this._saveOffer({ offer, partnerID, partnerName: steamName, itemsToGive, itemsToReceive, isDonation });
          console.log(`[${this.name}] Nová oboustranná nabídka #${offer.id} od ${steamName} (čeká na schválení)`);
          this._log(`NOVÁ NABÍDKA #${offer.id} OD: ${steamName} (čeká na schválení v adminu)`);
        });
      }
    });
  }

  _serializeItem(item) {
    return {
      name: item.name || item.market_hash_name || 'Neznámý',
      market_hash_name: item.market_hash_name || '',
      icon_url: item.icon_url || '',
      icon_url_large: item.icon_url_large || '',
      amount: item.amount || 1,
      appid: item.appid || 730,
    };
  }

  _saveOffer({ offer, partnerID, partnerName, itemsToGive, itemsToReceive, isDonation }) {
    const trades = loadTrades();
    const existing = trades.find(t => t.offer_id === offer.id);
    if (existing) return;
    trades.push({
      offer_id: offer.id,
      trade_id: offer.tradeID || null,
      partner_steamid: partnerID,
      partner_name: partnerName || partnerID,
      account_index: this.index,
      account_name: this.name,
      state: isDonation ? 'auto-accepting' : 'pending',
      created_at: Date.now(),
      items_to_give: itemsToGive,
      items_to_receive: itemsToReceive,
    });
    saveTrades(trades);
  }

  _updateOfferState(offerId, state) {
    const trades = loadTrades();
    const trade = trades.find(t => t.offer_id === offerId);
    if (trade) {
      trade.state = state;
      saveTrades(trades);
    }
  }

  respondToOffer(offerId, action) {
    return new Promise((resolve, reject) => {
      this.manager.getOffer(offerId, (err, offer) => {
        if (err) return reject(new Error(`Chyba načtení nabídky: ${err.message}`));
        if (!offer) return reject(new Error('Nabídka nenalezena'));
        const cb = (err2) => {
          if (err2) return reject(new Error(`Chyba ${action}: ${err2.message}`));
          this._updateOfferState(offerId, action === 'accept' ? 'accepted' : 'declined');
          resolve({ status: 'ok', action, offer_id: offerId });
        };
        if (action === 'accept') offer.accept(cb);
        else offer.decline(cb);
      });
    });
  }

  setRichPresence() {
    try {
      const s = settingsMod.load();
      this.client.setPersona(SteamUser.EPersonaState.Online);
      if (s.steam_rich_presence) {
        this.client.gamesPlayed([730]);
        console.log(`[${this.name}] Hraje: Counter-Strike 2`);
      } else {
        this.client.gamesPlayed([]);
        console.log(`[${this.name}] Online (bez hry)`);
      }
    } catch (e) {
      console.log(`[${this.name}] Chyba nastavení hry: ${e.message}`);
    }
  }

  _scheduleReconnect() {
    if (this._reconnectAttempts >= this._maxReconnect) {
      console.log(`[${this.name}] Dosáhl maximálního počtu pokusů o znovupřipojení.`);
      return;
    }
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectAttempts++;
    const delay = Math.min(5000 * Math.pow(2, this._reconnectAttempts - 1), 300000);
    this._reconnectTimer = setTimeout(() => {
      if (this._reconnectAttempts > 0) {
        console.log(`[${this.name}] Pokus o znovupřipojení #${this._reconnectAttempts}... (po ${Math.round(delay / 1000)}s)`);
        botStatus.setReconnecting(this.index);
        this.client.logOn({
          accountName: this.client.accountName || this.name,
          password: this.client._password,
          twoFactorCode: (() => { try { return SteamTotp.generateAuthCode(this.client._sharedSecret); } catch { return undefined; } })(),
        });
      }
    }, delay);
  }

  setup2FA() {
    return new Promise((resolve, reject) => {
      this.community.enableTwoFactor((err, response) => {
        if (err) return reject(err);
        if (response && response.success) {
          resolve({
            shared_secret: response.shared_secret,
            identity_secret: response.identity_secret,
            revocation_code: response.revocation_code,
          });
        } else {
          reject(new Error(response ? JSON.stringify(response) : '2FA selhalo'));
        }
      });
    });
  }

  _log(message) {
    const timestamp = new Date().toLocaleString('cs-CZ');
    const fs = require('fs');
    fs.appendFileSync(this.logFile, `[${timestamp}] [${this.name}] ${message}\n`, 'utf8');
  }

  _writeAlert(data) {
    const fs = require('fs');
    fs.writeFileSync(this.alertFile, JSON.stringify(data, null, 2), 'utf8');
    if (this.alertQueueFile) {
      alertQueue.push(this.alertQueueFile, data);
    }
  }
}

module.exports = AccountBot;
