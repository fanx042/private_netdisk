#!/bin/bash

# 进入前端目录
cd ../frontend
echo "正在启动前端服务..."

# 安装依赖
echo "安装依赖..."
npm install

# 启动开发服务器
echo "启动 Vite 开发服务器..."
npm run dev