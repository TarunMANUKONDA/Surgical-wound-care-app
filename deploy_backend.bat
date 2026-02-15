@echo off
setlocal EnableDelayedExpansion

echo ===========================================
echo   Surgical Wound Care App - Backend Deploy
echo ===========================================

set "XAMPP_DIR=C:\xampp\htdocs\wound-care-api"
set "SOURCE_DIR=%~dp0"

echo.
echo Deploying to: %XAMPP_DIR%
echo Source: %SOURCE_DIR%
echo.

if not exist "%XAMPP_DIR%" (
    echo Creating target directory...
    mkdir "%XAMPP_DIR%"
    mkdir "%XAMPP_DIR%\api"
    mkdir "%XAMPP_DIR%\config"
    mkdir "%XAMPP_DIR%\python"
    mkdir "%XAMPP_DIR%\python\models"
    mkdir "%XAMPP_DIR%\uploads"
)

echo Copying PHP files to api directory...
copy /Y "%SOURCE_DIR%backend-files\*.php" "%XAMPP_DIR%\api\"

echo Copying config files...
if not exist "%XAMPP_DIR%\config" mkdir "%XAMPP_DIR%\config"
copy /Y "%SOURCE_DIR%backend-files\database.php" "%XAMPP_DIR%\config\"
copy /Y "%SOURCE_DIR%backend-files\cors.php" "%XAMPP_DIR%\config\"

echo Copying Python scripts...
copy /Y "%SOURCE_DIR%python\classify_wound.py" "%XAMPP_DIR%\python\"
copy /Y "%SOURCE_DIR%python\requirements.txt" "%XAMPP_DIR%\python\"

echo.
echo Installing Python dependencies...
cd /d "%XAMPP_DIR%\python"
pip install -r requirements.txt

echo.
echo ===========================================
echo   Deployment Complete!
echo ===========================================
echo.
pause
