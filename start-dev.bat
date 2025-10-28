@echo off
setlocal
cd /d "%~dp0"

start "GastosApp - Backend" cmd /k "%~dp0backend.cmd"
start "GastosApp - Frontend" cmd /k "%~dp0frontend.cmd"

REM abre o navegador depois de alguns segundos
timeout /t 5 >nul
start "" "http://localhost:5173"

echo ==============================================
echo  Servidores iniciados (backend e frontend).
echo  O navegador deve abrir em http://localhost:5173
echo  Para parar, feche as janelas ou Ctrl+C nelas.
echo ==============================================
endlocal
