from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import os
import random
import string
from pathlib import Path

from models import Base, User, FileInfo
from database import SessionLocal, engine
from schemas import UserCreate, Token, FileInfoResponse
from auth import create_access_token, get_current_user, get_password_hash, verify_password

# 创建数据库表
Base.metadata.create_all(bind=engine)

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
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# 用户登录
@app.post("/api/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# 上传文件
@app.post("/api/files/upload")
def upload_file(
    file: UploadFile = File(...),
    is_private: bool = Form(False),
    download_code: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 检查文件格式
    allowed_extensions = {'.txt', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.zip', '.rar'}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # 保存文件
    file_path = UPLOAD_DIR / file.filename
    with open(file_path, "wb") as buffer:
        content = file.file.read()
        buffer.write(content)

    # 生成或使用提供的下载码
    if is_private:
        final_download_code = download_code if download_code else generate_download_code()
    else:
        final_download_code = None

    # 保存文件信息到数据库
    db_file = FileInfo(
        filename=file.filename,
        filepath=str(file_path),
        upload_time=datetime.now(),
        user_id=current_user.id,
        is_private=is_private,
        download_code=final_download_code if is_private else None
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return {"message": "File uploaded successfully", "download_code": final_download_code if is_private else None}

# 获取文件列表
@app.get("/api/files", response_model=List[FileInfoResponse])
def get_files(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    files = db.query(FileInfo).order_by(FileInfo.upload_time.desc()).all()
    return [
        FileInfoResponse(
            id=file.id,
            filename=file.filename,
            upload_time=file.upload_time,
            uploader=file.user.username,
            is_private=file.is_private,
            download_code=file.download_code if file.user_id == current_user.id else None
        )
        for file in files
    ]

# 下载文件
@app.get("/api/files/{file_id}")
def download_file(
    file_id: int,
    download_code: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file = db.query(FileInfo).filter(FileInfo.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.is_private and file.user_id != current_user.id:
        if not download_code or download_code != file.download_code:
            raise HTTPException(status_code=403, detail="Invalid download code")

    return FileResponse(
        path=file.filepath,
        filename=file.filename,
        media_type='application/octet-stream'
    )

# 获取用户信息
@app.get("/api/user/me")
def get_user_info(current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "id": current_user.id
    }

# 删除文件
@app.delete("/api/files/{file_id}")
def delete_file(
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
    
    return {"message": "File deleted successfully"}

# 更新用户信息
@app.put("/api/user/me")
def update_user_info(
    new_password: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    return {"message": "Password updated successfully"}