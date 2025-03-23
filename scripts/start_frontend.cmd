@echo off
cd ..\frontend
echo 正在启动前端服务...

REM 安装依赖
echo 安装依赖...
npm install

REM 启动开发服务器
echo 启动 Vite 开发服务器...
npm run dev

pause