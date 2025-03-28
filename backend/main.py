from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request, Response
from fastapi.background import BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from typing import Optional
import ipaddress
import mimetypes
import io
from PIL import Image
import tempfile
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
from pathlib import Path

# 注册中文字体
FONT_PATH = Path(__file__).parent / "fonts"
FONT_PATH.mkdir(exist_ok=True)

# 下载并注册中文字体（如果不存在）
def ensure_chinese_font():
    font_file = FONT_PATH / "simhei.ttf"
    if not font_file.exists():
        try:
            # 如果字体文件不存在，尝试从Windows系统字体目录复制
            windows_font = Path("C:/Windows/Fonts/simhei.ttf")
            if windows_font.exists():
                import shutil
                shutil.copy(str(windows_font), str(font_file))
            else:
                # 如果Windows字体不存在，使用内置的DejaVuSans
                pdfmetrics.registerFont(TTFont('Chinese', 'DejaVuSans.ttf'))
                return 'DejaVuSans'
        except Exception as e:
            logging.error(f"Font setup error: {e}")
            # 如果出错，使用内置的DejaVuSans
            return 'DejaVuSans'
    
    try:
        # 注册字体
        pdfmetrics.registerFont(TTFont('Chinese', str(font_file)))
        return 'Chinese'
    except:
        # 如果注册失败，使用内置的DejaVuSans
        logging.error(f"Font setup error: {e}")
        pdfmetrics.registerFont(TTFont('Chinese', 'DejaVuSans.ttf'))
        return 'DejaVuSans'

# 转换文本为PDF
def text_to_pdf(text, font_name='Chinese'):
    # 创建一个临时文件来保存PDF
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
            # 创建PDF文档
            c = canvas.Canvas(tmp_file.name, pagesize=A4)
            width, height = A4
            
            # 设置字体和大小
            c.setFont(font_name, 12)
            
            # 分割文本为行
            lines = text.split('\n')
            y = height - 50  # 起始位置（上边距）
            line_height = 15  # 行高
            margin = 50  # 左右边距
            
            # 写入每一行文本
            for line in lines:
                if y < 50:  # 如果到达页面底部
                    c.showPage()  # 创建新页面
                    y = height - 50  # 重置y坐标
                    c.setFont(font_name, 12)  # 重新设置字体
                
                # 处理过长的行
                while len(line) * 7 > (width - 2 * margin):  # 估算行宽
                    # 按照页面宽度截断行
                    break_point = int((width - 2 * margin) / 7)
                    c.drawString(margin, y, line[:break_point])
                    line = line[break_point:]
                    y -= line_height
                    
                    if y < 50:  # 检查是否需要新页面
                        c.showPage()
                        y = height - 50
                        c.setFont(font_name, 12)
                
                # 写入剩余的行或原始行
                if line:
                    c.drawString(margin, y, line)
                    y -= line_height
            
            c.save()
            return tmp_file.name
    except Exception as e:
        logging.error(f"Error generating PDF: {e}")
        return None

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
from schemas import UserCreate, Token, FileInfoResponse, FileInfo as FileInfoSchema
from auth import (
    create_access_token, get_current_user, get_password_hash, 
    verify_password, SECRET_KEY, ALGORITHM, logout_user,
    check_file_access_permission, check_file_management_permission
)

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

# 创建上传文件目录（使用绝对路径）
UPLOAD_DIR = Path(__file__).parent.absolute() / "uploads"
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


# 辅助函数：记录用户活动日志
def log_user_activity(request, action, username, extra_info=None):
    """统一记录用户活动日志"""
    client_ip = get_client_ip(request)
    log_message = f"{action} - Username: {username}, IP: {client_ip}"
    if extra_info:
        log_message += f", {extra_info}"
    logging.info(log_message)


# 用户注册
@app.post("/api/register", response_model=Token)
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    # 用户名不能重复
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    access_token = create_access_token(data={"sub": user.username}, db=db, user=db_user)
    
    # 记录注册信息
    log_user_activity(request, "New user registered", user.username)
    
    return {"access_token": access_token, "token_type": "bearer"}


# 用户登录
@app.post("/api/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        # 记录登录失败信息
        log_user_activity(request, "Failed login attempt", form_data.username)
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
    log_user_activity(request, "Successful login", user.username)
    
    return {"access_token": access_token, "token_type": "bearer"}


# 用户注销
@app.post("/api/logout")
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logout_user(db, current_user)
    # 记录注销信息
    log_user_activity(request, "User logged out", current_user.username)
    return {"message": "Successfully logged out"}

# 上传文件
# 辅助函数：获取允许的文件扩展名和MIME类型映射
def get_allowed_extensions():
    """返回允许上传的文件扩展名和对应的MIME类型"""
    return {
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
    allowed_extensions = get_allowed_extensions()
    
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
    log_file_access(request, "uploaded", db_file.id, file.filename, current_user, f"Private: {is_private}")

    return {
        "message": "File uploaded successfully", 
        "file_id": db_file.id,
        "download_code": final_download_code if is_private else None
    }

# 获取文件列表
@app.get("/api/files", response_model=List[FileInfoResponse])
def get_files(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 记录文件列表请求
    log_user_activity(request, "File list requested", current_user.username)
    
    # 获取所有文件
    files = db.query(FileInfo).order_by(FileInfo.upload_time.desc()).all()
    
    # 处理文件列表
    file_list = []
    for file in files:
        file_list.append(
            FileInfoResponse(
                id=file.id,
                filename=file.filename,
                filepath=file.filepath,
                upload_time=file.upload_time,
                uploader=file.user.username,
                is_private=file.is_private,
                # 只有文件上传者可以看到下载码
                download_code=file.download_code if file.user_id == current_user.id else None,
                downloads=file.downloads,
                file_type=file.file_type,
                can_preview=is_file_previewable(file.file_type)
            )
        )
    return file_list

# 获取文件信息
# 辅助函数：检查文件是否可预览
def is_file_previewable(file_type):
    """检查文件类型是否支持预览"""
    return file_type in ['text/plain', 'image/jpeg', 'image/png', 'application/pdf']

# 辅助函数：记录文件访问日志
def log_file_access(request, action, file_id, filename, downloads=None, current_user=None, extra_info=None):
    """统一记录文件访问日志"""
    client_ip = get_client_ip(request)
    user_info = f"Username: {current_user.username}" if current_user else "Unauthenticated user"
    if action == 'downloaded':
        log_message = f"File {action} - {user_info}, File ID: {file_id}, Filename: {filename}, Downloads: {downloads} IP: {client_ip}"
    else:
        log_message = f"File {action} - {user_info}, File ID: {file_id}, Filename: {filename}, IP: {client_ip}"
    if extra_info:
        log_message += f", {extra_info}"
    logging.info(log_message)

@app.get("/api/files/{file_id}/info")
async def get_file_info(
    request: Request,
    file_id: int,
    download_code: str = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取文件信息"""
    try:
        file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 如果是私密文件，需要验证访问权限 - 不需要检查权限
        # check_file_access_permission(current_user, file, download_code)

        # 记录文件信息访问
        log_file_access(request, "info accessed", file_id, file.filename, current_user)
        
        # 返回文件基本信息
        return {
            "id": file.id,
            "filename": file.filename,
            "filepath": file.filepath,
            "upload_time": file.upload_time,
            "uploader": file.user.username,
            "is_private": file.is_private,
            "file_type": file.file_type,
            "can_preview": is_file_previewable(file.file_type),
            # 只有在以下情况下返回下载码：1.文件所有者 2.提供了正确的下载码
            "download_code": file.download_code if (current_user and current_user.id == file.user_id) or (download_code and download_code == file.download_code) else None,
            "size": os.path.getsize(file.filepath) if os.path.exists(file.filepath) else 0,
            "downloads": file.downloads or 0
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error getting file info {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="获取文件信息失败")

# 下载文件
@app.get("/api/files/{file_id}")
async def download_file(
    request: Request,
    file_id: int,
    download_code: str = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """下载文件"""
    try:
        file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
        if not file:
            raise HTTPException(status_code=404, detail="文件不存在")
        
        # 检查访问权限 - 对于公开文件，即使未登录也可以访问
        if file.is_private:
            # 私密文件需要检查权限
            check_file_access_permission(current_user, file, download_code)
        
        # 检查文件是否存在
        file_path = Path(file.filepath)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="文件不存在或已被删除")
        
        # 确保文件类型正确
        content_type = file.file_type
        if not content_type:
            # 如果数据库中没有记录文件类型，尝试从文件扩展名推断
            content_type = mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
        
        # 更新下载次数
        file.downloads = (file.downloads or 0) + 1
        db.commit()
        
        
        # 记录下载信息
        log_file_access(request, "downloaded", file_id, file.filename, file.downloads, current_user)
        
        # 获取请求的语言
        accept_language = request.headers.get("accept-language", "").lower()
        
        # 使用 RFC 5987 规范处理文件名编码，解决中文文件名问题
        # 对于所有用户，优先使用 UTF-8 编码并添加 filename* 参数
        try:
            # URL编码文件名（保留空格为%20）
            import urllib.parse
            encoded_filename_utf8 = urllib.parse.quote(file.filename)
            
            # 提供两种格式的文件名，确保最大兼容性
            # 1. filename: 基本兼容性 (ASCII 文件名)
            # 2. filename*: 扩展支持 (RFC 5987, 支持 UTF-8)
            ascii_filename = file.filename.encode('ascii', 'ignore').decode('ascii')
            content_disposition = f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename_utf8}'
        except Exception as e:
            logging.error(f"Error encoding filename: {str(e)}")
            # 回退方案：简单编码
            encoded_filename = file.filename.encode('utf-8').decode('latin-1')
            content_disposition = f'attachment; filename="{encoded_filename}"'
        
        return FileResponse(
            path=str(file_path),
            filename=file.filename,
            media_type=content_type,
            headers={
                "Content-Disposition": content_disposition
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error downloading file {file_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="文件下载失败，请稍后重试")


# 获取用户信息
@app.get("/api/user/me")
def get_user_info(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "id": current_user.id
    }


# 预览文件
@app.get("/api/files/{file_id}/preview", response_class=HTMLResponse)
async def preview_file(
    request: Request,
    file_id: int,
    download_code: str = None,
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """预览文件"""
    file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 检查访问权限 - 对于公开文件，即使未登录也可以访问
    if file.is_private:
        # 私密文件需要检查权限
        check_file_access_permission(current_user, file, download_code)
        
    if not os.path.exists(file.filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 检查文件是否可预览
    if not is_file_previewable(file.file_type):
        raise HTTPException(status_code=400, detail="此文件类型不支持预览")
    
    
    try:
        # 确保文件路径是绝对路径
        file_path = Path(file.filepath)
        if not file_path.is_file():
            raise HTTPException(status_code=404, detail="文件不存在或已被删除")

        # 根据文件类型处理预览
        if file.file_type.startswith('image/'):
            
            # 图片文件
            return FileResponse(
                path=str(file_path),
                media_type=file.file_type,
                filename=file.filename
            )
        elif file.file_type == 'text/plain':
            # 文本文件 - 转换为PDF后预览
            try:
                # 首先尝试检测文件编码
                import chardet
                
                # 读取文件的前4096字节来检测编码
                with open(file_path, 'rb') as f:
                    raw = f.read(4096)
                    result = chardet.detect(raw)
                    encoding = result['encoding']
                
                # 如果检测失败，默认尝试 UTF-8
                if not encoding:
                    encoding = 'utf-8'
                
                # 使用检测到的编码读取文件
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                
                # 确保中文字体可用
                font_name = ensure_chinese_font()
                # 转换为PDF
                pdf_path = text_to_pdf(content, font_name)
                
                # 返回生成的PDF文件
                response = FileResponse(
                    path=str(pdf_path),
                    media_type='application/pdf',
                    filename=f"{os.path.basename(file.filename)}.pdf",
                    headers={
                        'Content-Disposition': f'inline; filename="{os.path.basename(file.filename)}.pdf"'
                    },
                    # background=BackgroundTasks(lambda: os.unlink(str(pdf_path)))  # 清理临时PDF文件
                )
                tasks = BackgroundTasks()
                tasks.add_task(os.unlink, str(pdf_path))  # 清理临时PDF文件
                return response
            except Exception as e:
                logging.error(f"Error converting text to PDF: {str(e)}")
                
                raise HTTPException(
                    status_code=400,
                    detail=f"无法转换文件为PDF：{str(e)}"
                )
        elif file.file_type == 'application/pdf':
            # PDF文件
            return FileResponse(
                path=str(file_path),
                media_type='application/pdf',
                filename=file.filename
            )
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"不支持预览的文件类型：{file.file_type}"
            )
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error previewing file {file_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="文件预览失败，请稍后重试"
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
    
    # 检查管理权限
    check_file_management_permission(current_user, file)
    
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
    log_file_access(request, "deleted", file_id, file.filename, current_user)
    
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
    log_user_activity(request, "Password updated", current_user.username)
    
    return {"message": "Password updated successfully"}