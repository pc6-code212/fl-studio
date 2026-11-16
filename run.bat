@echo off
title FL Studio Angular + Flask

:: Start Flask backend - keeps window open
start "FL Studio Backend" cmd /k "cd /d C:\Apps\dev\fl studio\backend && venv\Scripts\activate && python app.py"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Angular frontend - keeps window open
start "FL Studio Frontend" cmd /k "cd /d C:\Apps\dev\fl studio\frontend && ng serve"

:: Show instructions and exit
echo.
echo FL Studio Angular + Flask is running.
echo.
echo Backend: http://localhost:5000 (Flask API)
echo Frontend: http://localhost:4200 (Angular UI)
echo.
echo Each terminal window stays open. Press Ctrl+C in each to stop.