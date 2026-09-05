@echo off
title Genesy - Pubblicazione su Netlify
echo ============================================================
echo   PUBBLICAZIONE SU NETLIFY (genesy.netlify.app)
echo ============================================================
echo.
cd /d %~dp0\..
echo 1. Sincronizzazione cartella di deploy (__DEPLOY_ME__)...
powershell -ExecutionPolicy Bypass -File prepare_deploy.ps1
echo.
echo 2. Invio a Netlify in corso...
node deploy_netlify.js
echo.
pause
