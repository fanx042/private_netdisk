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

# 创建日志目录
if [ ! -d "logs" ]; then
    mkdir logs
fi

# 获取当前日期和时间作为日志文件名的一部分
timestamp=$(date +"%Y%m%d_%H%M%S")
log_file="logs/backend_${timestamp}.log"

# 启动服务
echo "启动 FastAPI 服务..."
echo "日志将被保存到: $log_file"
if command -v uvicorn &> /dev/null; then
    uvicorn main:app --reload --host 0.0.0.0 --port 8000 > "$log_file" 2>&1 &
else
    echo "uvicorn 命令未找到，尝试使用 python -m uvicorn..."
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > "$log_file" 2>&1 &
fi

# 显示日志尾部并保持进程在前台
echo "服务已在后台启动，显示实时日志..."
tail -f "$log_file"