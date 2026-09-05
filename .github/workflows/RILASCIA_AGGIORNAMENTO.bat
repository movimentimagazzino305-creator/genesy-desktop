@echo off
title Genesy Desktop - Rilascio Automatico Aggiornamento
echo ============================================================
echo   GENESY DESKTOP - RILASCIO AUTOMATICO AGGIORNAMENTO
echo ============================================================
echo.
cd /d "%~dp0"
node release.js
echo.
pause
