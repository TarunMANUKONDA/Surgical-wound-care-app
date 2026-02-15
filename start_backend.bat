@echo off
echo ====================================
echo  Surgical Wound Care - FastAPI Backend
echo ====================================
echo.

cd /d "%~dp0"

:: Navigate to backend directory
cd backend

:: Activate virtual environment
if exist "venv" (
    call venv\Scripts\activate
) else (
    echo venv not found in backend directory!
    pause
    exit /b
)

:: Start the server
echo Starting FastAPI backend server...
echo Server will be available at: http://localhost:8000
echo.

python main.py

pause
