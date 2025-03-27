#!/bin/bash

# 检查是否安装了nvm
if ! command -v nvm &> /dev/null; then
    echo "正在安装 nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# 确保nvm可用
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 检查Node.js版本
required_version="16.0.0"
current_version=$(node -v 2>/dev/null | cut -d'v' -f2)

if [[ -z "$current_version" ]] || [[ "$(printf '%s\n' "$required_version" "$current_version" | sort -V | head -n1)" == "$current_version" ]]; then
    echo "Node.js 版本过低或未安装，正在安装 Node.js 16..."
    nvm install 16
    nvm use 16
fi

# 进入前端目录
cd ../frontend
echo "正在启动前端服务..."

# 清理node_modules和package-lock.json
echo "清理旧的依赖..."
rm -rf node_modules package-lock.json

# 安装依赖
echo "安装依赖..."
npm install

# 启动开发服务器
echo "启动 Vite 开发服务器..."
npm run dev