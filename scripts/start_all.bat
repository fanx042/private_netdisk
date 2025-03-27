@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM Change to script directory
cd /d "%~dp0"

REM Check if dependency update is needed
set update_deps=
if "%1"=="--update-deps" (
    set update_deps=--update-deps
    echo Starting services with dependency update mode...
)

REM Start backend service
echo Starting backend service...
start cmd /c "chcp 65001 > nul && call start_backend.cmd"

REM Wait for backend to start
echo Waiting for backend service to initialize...
timeout /t 3 /nobreak > nul

REM Start frontend service
echo Starting frontend service...
start cmd /c "chcp 65001 > nul && call start_frontend.cmd %update_deps%"

REM Display service information
echo ==========================================
echo All services are running
echo Backend service: http://localhost:8000
echo Frontend service: http://localhost:5173 (Default Vite port)
echo Backend logs are saved in backend/logs directory
echo Press any key in respective windows to stop services
echo ==========================================

echo Press any key to exit this control window...
pause > nul