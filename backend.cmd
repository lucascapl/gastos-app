@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\activate.bat" (
  echo [backend] Ambiente virtual nao encontrado.
  echo [backend] Rode uma vez:
  echo   python -m venv .venv
  echo   .venv\Scripts\activate
  echo   pip install -r requirements.txt
  pause
  goto :eof
)

call ".venv\Scripts\activate.bat" || goto :eof

REM --- Flask ---
set FLASK_APP=backend.app
set FLASK_RUN_PORT=5000
set FLASK_ENV=development
echo [backend] Aplicando migracoes...
alembic upgrade head || (
  echo [backend] Falha ao aplicar migracoes.
  pause
  goto :eof
)

echo [backend] Subindo Flask em http://localhost:5000 ...
flask run --debug
endlocal
