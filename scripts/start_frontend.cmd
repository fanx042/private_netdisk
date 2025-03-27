@echo off
setlocal enabledelayedexpansion

REM 检查Node.js版本
node --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js未安装，请先安装Node.js
    pause
    exit /b 1
)

REM 获取当前Node.js版本
for /f "tokens=1 delims=v" %%a in ('node --version') do set current_version=%%a
set required_version=16.0.0

REM 比较版本号（简化版比较，仅检查主版本号）
for /f "tokens=1 delims=." %%a in ("%current_version%") do set current_major=%%a
if %current_major% LSS 16 (
    echo Node.js版本过低，当前版本为%current_version%，需要16.0.0或更高版本
    echo 请升级Node.js或使用nvm安装更高版本
    pause
    exit /b 1
)

REM 进入前端目录
cd ..\frontend
echo 正在启动前端服务...

REM 检查是否需要更新依赖
if "%1"=="--update-deps" (
    echo 更新依赖模式：清理旧的依赖...
    if exist node_modules (
        rmdir /s /q node_modules
    )
    if exist package-lock.json (
        del /f /q package-lock.json
    )
    echo 安装新的依赖...
    call npm install
) else (
    REM 如果node_modules不存在，则安装依赖
    if not exist node_modules (
        echo 未检测到node_modules，安装依赖...
        call npm install
    )
)

REM 启动开发服务器
echo 启动Vite开发服务器...
call npm run dev