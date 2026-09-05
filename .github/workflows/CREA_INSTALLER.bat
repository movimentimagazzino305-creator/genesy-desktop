@echo off
title Genesy Desktop - Creazione Installer Windows
color 0A
echo ========================================================
echo   GENESY DESKTOP - Creazione Pacchetto Installer (.exe)
echo ========================================================
echo.
echo Generazione del file di installazione Windows in corso...
cd /d "%~dp0"
if not exist "dist" mkdir "dist"
npx.cmd -y electron-builder --win -c.directories.output="%TEMP%\genesy_builder_out"
copy /y "%TEMP%\genesy_builder_out\*.exe" "dist\" >nul 2>&1

echo.
echo ========================================================
echo   COMPLETATO!
echo   I file di installazione si trovano nella cartella:
echo   Genesy_Desktop\dist
echo ========================================================
pause
