@echo off
title Genesy Desktop - Creazione Installer Mac
color 0B
echo ========================================================
echo   GENESY DESKTOP - Creazione Pacchetto Mac (.dmg / .zip)
echo ========================================================
echo.
cd /d "%~dp0"
if not exist "dist" mkdir "dist"
echo Avvio compilazione con electron-builder per macOS...
npx.cmd -y electron-builder --mac
echo.
echo ========================================================
echo   COMPLETATO!
echo   I file Mac si trovano nella cartella: Genesy_Desktop\dist
echo ========================================================
pause
