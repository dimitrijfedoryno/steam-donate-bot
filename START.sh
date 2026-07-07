#!/bin/bash
cd "$(dirname "$0")"

# --- 1. Check / install Node.js ---
if ! command -v node &>/dev/null; then
    echo "[NODE] Node.js nenalezen. Instaluji..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &>/dev/null; then
            brew install node
        else
            curl -fsSL https://nodejs.org/dist/v20.20.0/node-v20.20.0.pkg -o /tmp/node.pkg
            sudo installer -pkg /tmp/node.pkg -target /
        fi
    else
        # Linux
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs || sudo yum install -y nodejs
    fi
    if ! command -v node &>/dev/null; then
        echo "[NODE] Chyba instalace Node.js. Instaluj rucne z https://nodejs.org"
        exit 1
    fi
    echo "[NODE] Node.js nainstalovan: $(node --version)"
fi
echo "[NODE] Node.js: OK ($(node --version))"

# --- 2. Install root dependencies ---
if [ ! -d "node_modules" ]; then
    echo "[NPM] Instaluji zavislosti bota..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[NPM] Chyba instalace zavislosti bota."
        exit 1
    fi
fi
echo "[NPM] Bot zavislosti: OK"

# --- 3. Install admin dependencies ---
if [ ! -d "admin/node_modules" ]; then
    echo "[NPM] Instaluji zavislosti admin..."
    cd admin
    npm install
    if [ $? -ne 0 ]; then
        echo "[NPM] Chyba instalace zavislosti admin."
        exit 1
    fi
    cd ..
fi
echo "[NPM] Admin zavislosti: OK"

# --- 4. Build admin ---
if [ ! -d "admin/dist" ]; then
    echo "[BUILD] Buildim admin SPA..."
    cd admin
    npm run build
    if [ $? -ne 0 ]; then
        echo "[BUILD] Chyba buildu admin."
        exit 1
    fi
    cd ..
fi
echo "[BUILD] Admin SPA: OK"

# --- 5. Start bot ---
echo "[BOT] Spoustim Steam Donate Bot..."
node src/gui.js
