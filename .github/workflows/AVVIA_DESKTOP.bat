@echo off
title Genesy Desktop - Avvio
color 0B
echo.
echo ================================================
echo   GENESY DESKTOP - Avvio Applicazione
echo ================================================
echo.
cd /d "%~dp0"
npx -y electron .
