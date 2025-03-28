from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class FileInfoBase(BaseModel):
    filename: str
    is_private: bool

class FileInfoCreate(FileInfoBase):
    pass

class FileInfo(FileInfoBase):
    """完整的文件信息模型"""
    id: int
    upload_time: datetime
    uploader: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    downloads: Optional[int] = 0
    filepath: Optional[str] = None
    
    class Config:
        orm_mode = True

class FileInfoResponse(FileInfo):
    """API响应中的文件信息模型"""
    download_code: Optional[str] = None
    can_preview: bool = False
    
    class Config:
        orm_mode = True