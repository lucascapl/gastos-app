@echo off
setlocal
cd /d "%~dp0frontend"

if not exist ".env" (
  echo [frontend] Criando frontend\.env ...
  echo VITE_API_URL=http://localhost:5000> ".env"
)

echo [frontend] Subindo Vite (npm run dev)...
npm run dev
endlocal
