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

class FileInfoResponse(FileInfoBase):
    id: int
    upload_time: datetime
    uploader: str
    download_code: Optional[str] = None
    file_type: str
    can_preview: bool
    
    class Config:
        orm_mode = True