@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM Check Node.js installation
call node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Get current Node.js version
for /f "tokens=* delims=" %%a in ('node --version') do set node_version=%%a
echo Detected Node.js version: !node_version!

REM Extract major version number (remove 'v' prefix and keep only first number)
set node_version=!node_version:~1!
for /f "tokens=1 delims=." %%a in ("!node_version!") do set major_version=%%a

REM Check if version meets requirements
if !major_version! LSS 16 (
    echo Node.js version is too low. Current version: !node_version!, required: 16.0.0 or higher.
    echo Please upgrade Node.js or use nvm to install a newer version.
    pause
    exit /b 1
)

REM Change to frontend directory
cd ..\frontend
echo Starting frontend service...

REM Check if dependency update is needed
if "%1"=="--update-deps" (
    echo Update dependencies mode: Cleaning old dependencies...
    if exist node_modules (
        rmdir /s /q node_modules
    )
    if exist package-lock.json (
        del /f /q package-lock.json
    )
    echo Installing new dependencies...
    call npm install
) else (
    REM If node_modules doesn't exist, install dependencies
    if not exist node_modules (
        echo node_modules not detected, installing dependencies...
        call npm install
    )
)

REM Start development server
echo Starting Vite development server...
call npm run dev