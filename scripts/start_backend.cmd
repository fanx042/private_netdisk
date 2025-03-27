@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM 进入后端目录
cd ..\backend
echo 正在启动后端服务...

REM 检查并激活conda虚拟环境disk
call conda --version >nul 2>&1
if %errorlevel% neq 0 (
    echo conda未安装或不在PATH中，请先安装conda
    pause
    exit /b 1
)

REM 检查环境是否存在，不存在则创建
call conda env list | findstr /C:"net_disk " >nul
if %errorlevel% neq 0 (
    echo conda环境net_disk不存在，正在创建并激活...
    call conda create -n net_disk python=3.8 -y
) else (
    echo conda环境net_disk已存在，正在激活...
)
call conda activate net_disk

REM 安装依赖
echo 安装依赖...
pip install -r requirements.txt

REM 创建上传目录
if not exist uploads (
    mkdir uploads
)

REM 创建日志目录
if not exist logs (
    mkdir logs
)

REM 获取当前日期和时间作为日志文件名的一部分
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set timestamp=%datetime:~0,8%_%datetime:~8,6%
set log_file=logs\backend_%timestamp%.log

REM 启动服务
echo 启动 FastAPI 服务...
echo 日志将被保存到: %log_file%

REM 检查uvicorn是否可用
where uvicorn >nul 2>&1
if %errorlevel% equ 0 (
    start /b cmd /c "uvicorn main:app --reload --host 0.0.0.0 --port 8000 > %log_file% 2>&1"
) else (
    echo uvicorn命令未找到，尝试使用python -m uvicorn...
    start /b cmd /c "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > %log_file% 2>&1"
)

REM 显示日志内容
echo 服务已在后台启动，显示实时日志...
timeout /t 2 /nobreak > nul
type %log_file%
echo.
echo 按任意键停止服务...
pause > nul

REM 找到并终止uvicorn进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "0.0.0.0:8000"') do (
    taskkill /F /PID %%a
)
echo 后端服务已停止