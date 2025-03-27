from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User

# 配置
SECRET_KEY = "your-secret-key-here"  # 在生产环境中应该使用环境变量
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

# 密码处理
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

# Token处理
def create_access_token(data: dict, db: Session, user: User, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    # 更新用户的active_token
    user.active_token = encoded_jwt
    db.commit()
    
    return encoded_jwt

# 获取当前用户
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def logout_user(db: Session, user: User):
    user.active_token = None
    db.commit()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None or user.active_token != token:
        raise credentials_exception
    return user

def check_file_access_permission(user: User, file_info, download_code: Optional[str] = None):
    """
    检查用户是否有权限访问文件内容（下载或预览）
    
    Args:
        user: 当前用户
        file_info: 文件信息对象
        download_code: 下载码（可选）
        
    Raises:
        HTTPException: 当用户没有权限访问文件时
    """
    # 如果文件不是私密的，允许访问
    if not file_info.is_private:
        return True
        
    # 如果是文件上传者，允许访问
    if user and file_info.user_id == user.id:
        return True
        
    # 如果提供了正确的下载码，允许访问
    if download_code and download_code == file_info.download_code:
        return True
        
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="This is a private file. Please provide the correct download code to access it."
    )

def can_share_file(user: User, file_info):
    """
    检查用户是否有权限分享文件
    
    Args:
        user: 当前用户
        file_info: 文件信息对象
        
    Returns:
        bool: 是否可以分享文件
    """
    # 公开文件所有用户都可以分享
    if not file_info.is_private:
        return user is not None  # 只要是登录用户就可以分享公开文件
    
    # 私密文件只有上传者可以分享
    return user and file_info.user_id == user.id

def check_file_management_permission(user: User, file_info):
    """
    检查用户是否有权限管理文件（如修改、删除、分享等）
    
    Args:
        user: 当前用户
        file_info: 文件信息对象
        
    Raises:
        HTTPException: 当用户没有权限管理文件时
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
        
    if file_info.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to manage this file"
        )
    
    return True