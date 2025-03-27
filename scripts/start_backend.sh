#!/bin/bash

# 进入后端目录
cd ../backend
echo "正在启动后端服务..."

# 检查并激活conda虚拟环境disk
source $(conda info --base)/etc/profile.d/conda.sh
if conda info --envs | grep -q disk; then
    echo "conda环境disk已存在，正在激活..."
    conda activate disk
else
    echo "conda环境disk不存在，正在创建并激活..."
    conda create -n disk python=3.8 -y
    conda activate disk
fi

# 安装依赖
echo "安装依赖..."
pip install -r requirements.txt

# 创建上传目录
if [ ! -d "uploads" ]; then
    mkdir uploads
fi

# 启动服务
echo "启动 FastAPI 服务..."
uvicorn main:app --reload --host 0.0.0.0 --port 8000