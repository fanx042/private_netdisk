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

echo -e "\n===== 环境检查完成 ====="