@echo off
cd ..\backend
echo 正在启动后端服务...

REM 检查是否已安装虚拟环境
if not exist venv (
    echo 创建虚拟环境...
    python -m venv venv
)

REM 激活虚拟环境
call venv\Scripts\activate.bat

REM 安装依赖
echo 安装依赖...
pip install -r requirements.txt

REM 创建上传目录
if not exist uploads (
    mkdir uploads
)

REM 启动服务
echo 启动 FastAPI 服务...
uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause