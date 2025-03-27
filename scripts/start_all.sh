#!/bin/bash

# 进入脚本所在目录
cd "$(dirname "$0")"

# 启动后端服务
echo "正在启动后端服务..."
./start_backend.sh &
BACKEND_PID=$!
echo "后端服务进程ID: $BACKEND_PID"

# 等待几秒钟确保后端启动
sleep 3

# 启动前端服务
echo "正在启动前端服务..."
./start_frontend.sh

# 显示服务信息
echo "=========================================="
echo "所有服务已启动"
echo "后端服务运行在: http://localhost:8000"
echo "前端服务运行在: http://localhost:5173 (默认Vite端口)"
echo "按 Ctrl+C 停止所有服务"
echo "=========================================="

# 捕获终止信号
trap 'echo "正在停止所有服务..."; kill $BACKEND_PID 2>/dev/null; exit' INT TERM

# 保持脚本运行
wait $BACKEND_PID