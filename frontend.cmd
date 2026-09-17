@echo off
setlocal
cd /d "%~dp0frontend"

if not exist ".env" (
  echo [frontend] Criando frontend\.env ...
  echo VITE_API_URL=http://localhost:5000> ".env"
)

if not exist "node_modules" (
  echo [frontend] Instalando dependencias...
  call npm install || (
    echo [frontend] Falha ao instalar dependencias.
    pause
    goto :eof
  )
)

echo [frontend] Subindo Vite (npm run dev)...
npm run dev
endlocal
