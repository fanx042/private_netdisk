from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from typing import Optional
import ipaddress
import mimetypes
import io
from PIL import Image

def get_client_ip(request: Request) -> str:
    """获取客户端真实IP地址"""
    # 按优先级尝试获取IP地址
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For 格式可能是: client, proxy1, proxy2
        # 取第一个合法的IP地址
        for ip in forwarded_for.split(","):
            ip = ip.strip()
            try:
                # 验证IP地址的合法性
                ipaddress.ip_address(ip)
                if not (ip.startswith("127.") or ip.startswith("192.168.") or ip.startswith("10.")):
                    return ip
            except ValueError:
                continue
    
    # 尝试从其他header获取
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        try:
            ipaddress.ip_address(real_ip)
            return real_ip
        except ValueError:
            pass
    
    # 如果都没有，返回直接连接的客户端IP
    client_host = request.client.host
    try:
        ipaddress.ip_address(client_host)
        return client_host
    except ValueError:
        return "unknown"
    
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import os
import random
import string
import logging
from pathlib import Path
from jose import JWTError, jwt

from models import Base, User, FileInfo
from database import SessionLocal, engine
from schemas import UserCreate, Token, FileInfoResponse
from auth import create_access_token, get_current_user, get_password_hash, verify_password, SECRET_KEY, ALGORITHM, logout_user

# 创建数据库表
Base.metadata.create_all(bind=engine)

# 配置日志记录
LOG_DIR = Path("logs")
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    filename=LOG_DIR / "user_login.log",
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

app = FastAPI()

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，包括IP地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建上传文件目录
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# 依赖项
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 生成随机下载码
def generate_download_code():
    return ''.join(random.choices(string.digits, k=4))

# 用户注册
@app.post("/api/register", response_model=Token)
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    access_token = create_access_token(data={"sub": user.username}, db=db, user=db_user)
    
    # 记录注册信息
    client_ip = get_client_ip(request)
    logging.info(f"New user registered - Username: {user.username}, IP: {client_ip}")
    
    return {"access_token": access_token, "token_type": "bearer"}

# 用户登录
@app.post("/api/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        # 记录登录失败信息
        client_ip = get_client_ip(request)
        logging.warning(f"Failed login attempt - Username: {form_data.username}, IP: {client_ip}")
        raise HTTPException(status_code=400, detail="用户名或密码不正确")
    
    # 检查是否已在其他设备登录
    if user.active_token:
        try:
            # 验证旧token是否仍然有效
            jwt.decode(user.active_token, SECRET_KEY, algorithms=[ALGORITHM])
            # 即使token有效，我们也允许用户在新设备登录，并使旧token失效
            logging.info(f"User {user.username} logged in from new device, invalidating previous session")
        except JWTError:
            # 如果token已过期，可以继续登录
            logging.info(f"Previous token for user {user.username} has expired")
    
    access_token = create_access_token(data={"sub": user.username}, db=db, user=user)
    
    # 记录登录成功信息
    client_ip = get_client_ip(request)
    logging.info(f"Successful login - Username: {user.username}, IP: {client_ip}")
    
    return {"access_token": access_token, "token_type": "bearer"}

# 用户注销
@app.post("/api/logout")
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logout_user(db, current_user)
    # 记录注销信息
    client_ip = get_client_ip(request)
    logging.info(f"User logged out - Username: {current_user.username}, IP: {client_ip}")
    return {"message": "Successfully logged out"}

# 上传文件
@app.post("/api/files/upload")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    is_private: bool = Form(False),
    download_code: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 检查文件格式
    allowed_extensions = {
        '.txt': 'text/plain',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.zip': 'application/zip',
        '.rar': 'application/x-rar-compressed'
    }
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # 生成唯一的文件名以避免覆盖
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    unique_filename = f"{timestamp}_{file.filename}"
    file_path = UPLOAD_DIR / unique_filename

    # 保存文件
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")

    # 处理私密文件的下载码
    if is_private:
        # 验证用户提供的下载码是否符合4位数字要求
        if download_code:
            if not (len(download_code) == 4 and download_code.isdigit()):
                raise HTTPException(
                    status_code=400, 
                    detail="Download code must be exactly 4 digits"
                )
            final_download_code = download_code
        else:
            final_download_code = generate_download_code()
    else:
        final_download_code = None

    # 保存文件信息到数据库
    db_file = FileInfo(
        filename=file.filename,  # 保存原始文件名
        filepath=str(file_path),  # 保存实际存储路径
        upload_time=datetime.now(),
        user_id=current_user.id,
        is_private=is_private,
        download_code=final_download_code if is_private else None,
        file_type=allowed_extensions[file_ext],
        downloads=0
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    # 记录文件上传信息
    client_ip = get_client_ip(request)
    logging.info(f"File uploaded - Username: {current_user.username}, Filename: {file.filename}, Private: {is_private}, IP: {client_ip}")

    return {
        "message": "File uploaded successfully", 
        "file_id": db_file.id,
        "download_code": final_download_code if is_private else None
    }

# 获取文件列表
@app.get("/api/files", response_model=List[FileInfoResponse])
def get_files(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 记录文件列表请求
    client_ip = get_client_ip(request)
    logging.info(f"File list requested - Username: {current_user.username}, IP: {client_ip}")
    files = db.query(FileInfo).order_by(FileInfo.upload_time.desc()).all()
    return [
        FileInfoResponse(
            id=file.id,
            filename=file.filename,
            upload_time=file.upload_time,
            uploader=file.user.username,
            is_private=file.is_private,
            download_code=file.download_code if file.user_id == current_user.id else None,
            file_type=file.file_type,
            can_preview=file.file_type in ['text/plain', 'image/jpeg', 'image/png', 'application/pdf']
        )
        for file in files
    ]

# 下载文件
@app.get("/api/files/{file_id}")
async def download_file(
    request: Request,
    file_id: int,
    download_code: str = None,
    db: Session = Depends(get_db)
):
    """下载文件"""
    file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 检查私密文件是否提供了正确的下载码
    if file.is_private and file.download_code != download_code:
        client_ip = get_client_ip(request)
        logging.warning(f"Invalid download attempt - File ID: {file_id}, IP: {client_ip}")
        raise HTTPException(status_code=403, detail="下载码错误或未提供")
    
    if not os.path.exists(file.filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 更新下载次数
    file.downloads = (file.downloads or 0) + 1
    db.commit()
    
    # 记录下载信息
    client_ip = get_client_ip(request)
    logging.info(f"File downloaded - File ID: {file_id}, Filename: {file.filename}, IP: {client_ip}")
    
    return FileResponse(
        path=file.filepath,
        filename=file.filename,
        media_type=file.file_type or 'application/octet-stream'
    )

@app.get("/api/files/{file_id}/info")
async def get_file_info(
    request: Request,
    file_id: int,
    download_code: str = None,
    db: Session = Depends(get_db)
):
    """获取文件基本信息（不包含下载码）"""
    file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 如果是私密文件，验证下载码
    if file.is_private and file.download_code != download_code:
        client_ip = get_client_ip(request)
        logging.warning(f"Invalid info request - File ID: {file_id}, IP: {client_ip}")
        raise HTTPException(status_code=403, detail="下载码错误或未提供")
    
    # 记录信息请求
    client_ip = get_client_ip(request)
    logging.info(f"File info requested - File ID: {file_id}, Filename: {file.filename}, IP: {client_ip}")
    
    # 返回文件基本信息，不包含敏感信息如下载码
    return {
        "id": file.id,
        "filename": file.filename,
        "file_type": file.file_type,
        "size": os.path.getsize(file.filepath) if os.path.exists(file.filepath) else 0,
        "is_private": file.is_private,
        "uploader": file.user.username if file.user else None,
        "upload_time": file.upload_time,
        "downloads": file.downloads or 0,
        "can_preview": file.file_type in ['text/plain', 'image/jpeg', 'image/png', 'application/pdf']
    }

# 获取用户信息
@app.get("/api/user/me")
def get_user_info(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "id": current_user.id
    }

# 预览文件
@app.get("/api/files/{file_id}/preview")
async def preview_file(
    request: Request,
    file_id: int,
    download_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # 检查访问权限
    if file.is_private:
        if not download_code or download_code != file.download_code:
            client_ip = get_client_ip(request)
            logging.warning(f"Invalid preview attempt - File ID: {file_id}, IP: {client_ip}")
            raise HTTPException(status_code=403, detail="Invalid download code")

    # 检查文件是否存在
    if not os.path.exists(file.filepath):
        raise HTTPException(status_code=404, detail="File not found")

    # 检查文件是否支持预览
    if file.file_type not in ['text/plain', 'image/jpeg', 'image/png', 'application/pdf']:
        raise HTTPException(status_code=400, detail="File type not supported for preview")

    # 记录预览信息
    client_ip = get_client_ip(request)
    logging.info(f"File previewed - File ID: {file_id}, Filename: {file.filename}, IP: {client_ip}")

    # 根据文件类型返回不同的预览响应
    if file.file_type == 'text/plain':
        try:
            with open(file.filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            return HTMLResponse(content=f"<pre>{content}</pre>")
        except UnicodeDecodeError:
            # 尝试其他编码
            try:
                with open(file.filepath, 'r', encoding='latin-1') as f:
                    content = f.read()
                return HTMLResponse(content=f"<pre>{content}</pre>")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error reading text file: {str(e)}")
    
    elif file.file_type.startswith('image/'):
        try:
            # 使用PIL处理图片预览
            with Image.open(file.filepath) as img:
                # 调整图片大小用于预览
                max_size = (800, 800)
                img.thumbnail(max_size)
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format=img.format)
                img_byte_arr.seek(0)
                return StreamingResponse(img_byte_arr, media_type=file.file_type)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")
    
    elif file.file_type == 'application/pdf':
        return FileResponse(
            path=file.filepath,
            media_type='application/pdf',
            filename=file.filename
        )
    
    # 默认情况，直接返回文件
    return FileResponse(
        path=file.filepath,
        media_type=file.file_type,
        filename=file.filename
    )

# 删除文件
@app.delete("/api/files/{file_id}")
def delete_file(
    request: Request,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    
    # 检查是否是文件的上传者
    if file.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # 删除物理文件
    try:
        os.remove(file.filepath)
    except OSError:
        # 如果文件不存在，继续删除数据库记录
        pass
    
    # 删除数据库记录
    db.delete(file)
    db.commit()
    
    # 记录文件删除信息
    client_ip = get_client_ip(request)
    logging.info(f"File deleted - Username: {current_user.username}, File ID: {file_id}, Filename: {file.filename}, IP: {client_ip}")
    
    return {"message": "File deleted successfully"}

# 更新用户信息
@app.put("/api/user/me")
def update_user_info(
    request: Request,
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    
    # 记录密码更新信息
    client_ip = get_client_ip(request)
    logging.info(f"Password updated - Username: {current_user.username}, IP: {client_ip}")
    
    return {"message": "Password updated successfully"}