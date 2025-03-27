@echo off
setlocal enabledelayedexpansion

REM 进入脚本所在目录
cd /d "%~dp0"

REM 检查是否需要更新依赖
set update_deps=
if "%1"=="--update-deps" (
    set update_deps=--update-deps
    echo 将以更新依赖模式启动服务...
)

REM 启动后端服务
echo 正在启动后端服务...
start cmd /c "call start_backend.cmd"

REM 等待几秒钟确保后端启动
echo 等待后端服务启动...
timeout /t 3 /nobreak > nul

REM 启动前端服务
echo 正在启动前端服务...
start cmd /c "call start_frontend.cmd %update_deps%"

REM 显示服务信息
echo ==========================================
echo 所有服务已启动
echo 后端服务运行在: http://localhost:8000
echo 前端服务运行在: http://localhost:5173 (默认Vite端口)
echo 后端日志保存在 backend/logs 目录中
echo 请在各自的命令窗口中按任意键停止相应服务
echo ==========================================

echo 按任意键退出此控制台窗口...
pause > nul