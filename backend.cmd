@echo off
setlocal
cd /d "%~dp0"

call ".venv\Scripts\activate.bat" || goto :eof


REM --- Flask ---
set FLASK_APP=backend.app
set FLASK_RUN_PORT=5000
set FLASK_ENV=development
echo [backend] Subindo Flask em http://localhost:5000 ...
flask run --debug
endlocal
