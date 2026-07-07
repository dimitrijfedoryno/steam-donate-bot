@echo off
title Steam Donate Bot
cd /d "%~dp0"

:: --- 1. Zkontrolovat / nainstalovat Node.js ---
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [NODE] Node.js nenalezen. Stahuji...
    set NODE_URL=https://nodejs.org/dist/v20.20.0/node-v20.20.0-x64.msi
    set MSI=%TEMP%\node-install.msi
    powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%MSI%' -UseBasicParsing; Write-Host 'Stazeno' } catch { Write-Host 'Chyba stahovani:'; Write-Host $_.Exception.Message; exit 1 }"
    if %ERRORLEVEL% neq 0 (
        echo [NODE] Chyba stahovani Node.js. Stahni rucne z https://nodejs.org
        pause
        exit /b 1
    )
    echo [NODE] Instaluji Node.js...
    msiexec /quiet /i "%MSI%" /norestart
    echo [NODE] Instalace dokoncena. Restartuj START.bat pro jistotu.
    pause
    exit /b 0
)
echo [NODE] Node.js: OK

:: --- 2. Zkontrolovat / nainstalovat zavislosti root ---
if not exist "node_modules" (
    echo [NPM] Instaluji zavislosti bota...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [NPM] Chyba instalace zavislosti bota.
        pause
        exit /b 1
    )
)
echo [NPM] Bot zavislosti: OK

:: --- 3. Zkontrolovat / nainstalovat zavislosti admin ---
if not exist "admin\node_modules" (
    echo [NPM] Instaluji zavislosti admin...
    cd admin
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [NPM] Chyba instalace zavislosti admin.
        pause
        exit /b 1
    )
    cd ..
)
echo [NPM] Admin zavislosti: OK

:: --- 4. Zkontrolovat / build admin ---
if not exist "admin\dist" (
    echo [BUILD] Buildim admin SPA...
    cd admin
    call npm run build
    if %ERRORLEVEL% neq 0 (
        echo [BUILD] Chyba buildu admin.
        pause
        exit /b 1
    )
    cd ..
)
echo [BUILD] Admin SPA: OK

:: --- 5. Spustit bota ---
echo [BOT] Spoustim Steam Donate Bot...
node src/gui.js
pause
