from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    active_token = Column(String, nullable=True)  # 存储当前活跃的token
    files = relationship("FileInfo", back_populates="user")

class FileInfo(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    upload_time = Column(DateTime)
    is_private = Column(Boolean, default=False)
    download_code = Column(String(4), nullable=True)  # 限制为4位
    file_type = Column(String)  # 存储文件类型
    downloads = Column(Integer, default=0)  # 下载次数
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="files")