@echo off
echo === Infra-Autopilot Backend Setup ===
echo.

cd /d %~dp0

echo [1/4] Creating Python virtual environment...
python -m venv .venv
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.11+ from python.org
    exit /b 1
)

echo [2/4] Activating venv and installing dependencies...
call .venv\Scripts\activate.bat
pip install -e ".[test]" --no-cache-dir

echo [3/4] Copying .env.example to .env (edit this with your credentials)...
if not exist .env (
    copy .env.example .env
    echo Created .env from .env.example. Edit it with your credentials before running.
) else (
    echo .env already exists - skipping copy.
)

echo [4/4] Verifying imports...
python -c "from app.core.types import *; print('  types.py OK')"
python -c "from app.config import get_settings; print('  config.py OK')"
python -c "from app.extraction.graph import extraction_graph; print('  extraction graph OK')"
python -c "from app.scanner.orchestrator import ScanOrchestrator; print('  scanner OK')"
python -c "from app.validation.engine import ValidationEngine; print('  validation engine OK')"

echo.
echo === Setup complete! ===
echo.
echo To start the backend server:
echo   cd backend
echo   .venv\Scripts\activate
echo   uvicorn app.main:app --reload --port 8000
echo.
echo Then open: http://localhost:8000/docs
echo.
echo To run tests (no DB/Azure needed):
echo   pytest tests/ -v
