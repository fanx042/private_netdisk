#!/bin/bash

echo "===== 环境检查脚本 ====="

# 检查Node.js版本
echo "检查Node.js版本..."
if command -v node &> /dev/null; then
    node_version=$(node -v)
    echo "当前Node.js版本: $node_version"
    
    # 提取版本号并比较
    version_number=${node_version#v}
    major_version=$(echo $version_number | cut -d. -f1)
    
    if [ "$major_version" -lt 14 ]; then
        echo "警告: Node.js版本低于推荐版本(v14+)"
        echo "建议使用nvm安装更新版本的Node.js:"
        echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        echo "source ~/.bashrc"
        echo "nvm install 16"
        echo "nvm use 16"
    else
        echo "Node.js版本满足要求"
    fi
else
    echo "未安装Node.js"
    echo "建议使用nvm安装Node.js:"
    echo "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "source ~/.bashrc"
    echo "nvm install 16"
    echo "nvm use 16"
fi

# 检查Conda
echo -e "\n检查Conda..."
if command -v conda &> /dev/null; then
    conda_version=$(conda --version)
    echo "当前Conda版本: $conda_version"
    
    # 检查disk环境
    if conda info --envs | grep -q disk; then
        echo "已存在conda环境: disk"
        
        # 检查disk环境中的Python版本
        echo "检查disk环境中的Python版本..."
        disk_python_version=$(conda run -n disk python --version 2>&1)
        if [[ $disk_python_version == Python* ]]; then
            echo "disk环境中的Python版本: $disk_python_version"
            
            # 提取版本号并比较
            version_number=$(echo $disk_python_version | cut -d' ' -f2)
            major_version=$(echo $version_number | cut -d. -f1)
            minor_version=$(echo $version_number | cut -d. -f2)
            
            if [ "$major_version" -lt 3 ] || ([ "$major_version" -eq 3 ] && [ "$minor_version" -lt 8 ]); then
                echo "警告: disk环境中的Python版本低于推荐版本(3.8+)"
                echo "建议更新disk环境的Python版本:"
                echo "conda activate disk"
                echo "conda install python=3.8"
            else
                echo "disk环境中的Python版本满足要求"
            fi
        else
            echo "无法获取disk环境中的Python版本"
        fi
    else
        echo "未找到conda环境: disk"
        echo "启动脚本将自动创建此环境"
    fi
else
    echo "未安装Conda"
    echo "建议安装Miniconda:"
    echo "wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh"
    echo "bash Miniconda3-latest-Linux-x86_64.sh"
fi

# 检查Python版本
echo -e "\n检查Python版本..."
if command -v python3 &> /dev/null; then
    python_version=$(python3 --version)
    echo "当前Python版本: $python_version"
else
    echo "未找到Python3"
    echo "建议安装Python3: sudo apt-get install python3"
fi

# 检查npm
echo -e "\n检查npm..."
if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    echo "当前npm版本: $npm_version"
else
    echo "未安装npm"
    echo "npm通常随Node.js一起安装"
fi

# 检查uvicorn
echo -e "\n检查uvicorn..."
if command -v uvicorn &> /dev/null; then
    uvicorn_version=$(uvicorn --version)
    echo "当前uvicorn版本: $uvicorn_version"
else
    echo "未安装uvicorn"
    echo "uvicorn将通过后端requirements.txt安装"
fi

# 检查后端关键依赖
echo -e "\n检查后端关键依赖..."
if conda info --envs | grep -q disk; then
    echo "在disk环境中检查依赖..."
    conda run -n disk pip list | grep -E "fastapi|uvicorn|sqlalchemy|pydantic"
else
    echo "disk环境不存在，无法检查后端依赖"
    echo "请先创建disk环境并安装依赖"
fi

echo -e "\n===== 环境检查完成 ====="
echo "如果发现任何问题，请按照上述建议进行修复。"
echo "环境准备就绪后，可以运行 ./scripts/start_all.sh 启动服务。"