# 个人网盘项目技术文档

## 1. 项目概述

这是一个基于React + FastAPI的现代化个人网盘系统，提供文件上传、下载、预览、分享等功能，支持私密文件访问控制。

### 1.1 核心功能

- 用户认证：注册、登录、登出
- 文件管理：上传、下载、预览、删除
- 访问控制：公开/私密文件、下载码保护
- 文件分享：生成分享链接、下载码分享
- 文件预览：支持文本、图片、PDF等格式
- 文件搜索：按文件名、上传者、类型搜索

### 1.2 技术栈

#### 后端技术栈
- FastAPI：高性能Python Web框架
- SQLAlchemy：ORM框架
- SQLite：数据库
- JWT：用户认证
- Python Pillow：图片处理
- ReportLab：PDF生成

#### 前端技术栈
- React：前端框架
- Ant Design：UI组件库
- React Query：数据获取和缓存
- Axios：HTTP客户端
- React Router：路由管理

## 2. 系统架构

### 2.1 后端架构

后端采用模块化设计，主要包含以下组件：

#### 2.1.1 核心模块

- `main.py`：应用入口和主要API路由
- `auth.py`：认证相关功能
- `models.py`：数据模型定义
- `schemas.py`：数据验证和序列化
- `database.py`：数据库配置

#### 2.1.2 数据模型

**User模型**
```python
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    active_token = Column(String, nullable=True)
    files = relationship("FileInfo", back_populates="user")
```

**FileInfo模型**
```python
class FileInfo(Base):
    __tablename__ = "files"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    upload_time = Column(DateTime)
    is_private = Column(Boolean, default=False)
    download_code = Column(String(4), nullable=True)
    file_type = Column(String)
    downloads = Column(Integer, default=0)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="files")
```

### 2.2 前端架构

前端采用组件化设计，主要包含以下部分：

#### 2.2.1 核心组件

- `App.jsx`：应用根组件
- `AuthContext.jsx`：认证上下文
- `HomePage.jsx`：主页面
- `LoginPage.jsx`：登录页面
- `RegisterPage.jsx`：注册页面
- `PreviewPage.jsx`：文件预览页面

#### 2.2.2 工具和服务

- `api.js`：API请求封装
- `fileUtils.js`：文件处理工具
- `AuthContext.jsx`：认证状态管理

## 3. API接口文档

### 3.1 认证相关接口

#### 登录
- 路径: `/api/login`
- 方法: POST
- 参数: 
  - username: 用户名
  - password: 密码
- 返回: 
  ```json
  {
    "access_token": "token字符串",
    "token_type": "bearer"
  }
  ```

#### 注册
- 路径: `/api/register`
- 方法: POST
- 参数:
  ```json
  {
    "username": "用户名",
    "password": "密码"
  }
  ```
- 返回: 同登录接口

### 3.2 文件相关接口

#### 上传文件
- 路径: `/api/files/upload`
- 方法: POST
- 参数:
  - file: 文件
  - is_private: 是否私密（可选）
  - download_code: 下载码（可选）
- 返回: 文件信息对象

#### 获取文件列表
- 路径: `/api/files`
- 方法: GET
- 返回: 文件信息对象数组

#### 下载文件
- 路径: `/api/files/{file_id}`
- 方法: GET
- 查询参数: download_code（私密文件必需）
- 返回: 文件内容

#### 预览文件
- 路径: `/api/files/{file_id}/preview`
- 方法: GET
- 查询参数: download_code（私密文件必需）
- 返回: 预览内容

## 4. 功能实现细节

### 4.1 文件上传流程

1. 前端实现：
```javascript
// FileUpload.jsx
const uploadFile = async (file, isPrivate, downloadCode) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('is_private', isPrivate);
  if (downloadCode) {
    formData.append('download_code', downloadCode);
  }

  try {
    const response = await axios.post('/api/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${authToken}`
      }
    });
    return response.data;
  } catch (error) {
    throw new Error('文件上传失败');
  }
};
```

2. 后端实现：
```python
# main.py
@router.post("/files/upload")
async def upload_file(
    file: UploadFile,
    is_private: bool = Form(False),
    download_code: str = Form(None),
    current_user: User = Depends(get_current_user)
):
    # 验证文件类型和大小
    if not allowed_file_type(file.filename):
        raise HTTPException(status_code=400, detail="不支持的文件类型")
    
    # 生成唯一文件名
    unique_filename = f"{uuid.uuid4()}_{secure_filename(file.filename)}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # 保存文件
    try:
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail="文件保存失败")
    
    # 创建文件信息记录
    db_file = FileInfo(
        filename=file.filename,
        filepath=unique_filename,
        upload_time=datetime.now(),
        is_private=is_private,
        download_code=download_code,
        file_type=get_file_type(file.filename),
        user_id=current_user.id
    )
    db.add(db_file)
    db.commit()
    
    return {"message": "文件上传成功", "file_id": db_file.id}
```

### 4.2 文件预览实现

1. 文本文件预览：
```python
# backend/main.py
@router.get("/files/{file_id}/preview")
async def preview_file(
    file_id: int,
    download_code: str = None,
    current_user: User = Depends(get_current_user)
):
    file_info = get_file_by_id(file_id)
    if not has_file_access(file_info, current_user, download_code):
        raise HTTPException(status_code=403, detail="访问被拒绝")

    if file_info.file_type == 'text':
        # 读取文本内容
        with open(os.path.join(UPLOAD_DIR, file_info.filepath), 'r') as f:
            content = f.read()
        
        # 使用ReportLab生成PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        # 配置中文字体
        pdfmetrics.registerFont(TTFont('SimHei', 'fonts/simhei.ttf'))
        styles['Normal'].fontName = 'SimHei'
        
        # 添加文本内容
        story.append(Paragraph(content, styles['Normal']))
        doc.build(story)
        
        buffer.seek(0)
        return StreamingResponse(
            buffer, 
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename={file_info.filename}.pdf"}
        )
```

2. 图片文件预览：
```python
# backend/main.py
@router.get("/files/{file_id}/preview")
async def preview_image(
    file_id: int,
    download_code: str = None,
    current_user: User = Depends(get_current_user)
):
    file_info = get_file_by_id(file_id)
    if not has_file_access(file_info, current_user, download_code):
        raise HTTPException(status_code=403, detail="访问被拒绝")

    if file_info.file_type in ['image/jpeg', 'image/png', 'image/gif']:
        return FileResponse(
            os.path.join(UPLOAD_DIR, file_info.filepath),
            media_type=file_info.file_type,
            filename=file_info.filename
        )
```

3. 前端预览组件：
```jsx
// FilePreview.jsx
const FilePreview = ({ fileId, fileType, downloadCode }) => {
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    const getPreviewUrl = async () => {
      try {
        const url = `/api/files/${fileId}/preview`;
        const params = downloadCode ? `?download_code=${downloadCode}` : '';
        setPreviewUrl(`${url}${params}`);
      } catch (error) {
        console.error('预览获取失败:', error);
      }
    };
    getPreviewUrl();
  }, [fileId, downloadCode]);

  if (!previewUrl) return <div>加载中...</div>;

  switch (fileType) {
    case 'image/jpeg':
    case 'image/png':
    case 'image/gif':
      return <img src={previewUrl} alt="文件预览" style={{ maxWidth: '100%' }} />;
    case 'application/pdf':
    case 'text':
      return (
        <iframe
          src={previewUrl}
          title="文件预览"
          width="100%"
          height="600px"
          style={{ border: 'none' }}
        />
      );
    default:
      return <div>不支持的文件类型</div>;
  }
};
```

### 4.3 私密文件访问控制

1. 后端访问控制实现：
```python
# auth.py
def has_file_access(file_info: FileInfo, user: User, download_code: str = None) -> bool:
    """
    检查用户是否有权限访问文件
    """
    # 文件所有者可直接访问
    if file_info.user_id == user.id:
        return True
    
    # 非私密文件可直接访问
    if not file_info.is_private:
        return True
    
    # 私密文件需要验证下载码
    if file_info.is_private:
        if not download_code:
            return False
        return file_info.download_code == download_code
    
    return False

# main.py
@router.get("/files/{file_id}")
async def get_file(
    file_id: int,
    download_code: str = None,
    current_user: User = Depends(get_current_user)
):
    file_info = get_file_by_id(file_id)
    if not file_info:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    if not has_file_access(file_info, current_user, download_code):
        raise HTTPException(status_code=403, detail="访问被拒绝")
    
    return FileResponse(
        os.path.join(UPLOAD_DIR, file_info.filepath),
        filename=file_info.filename
    )
```

2. 前端访问控制实现：
```jsx
// FileAccess.jsx
const FileAccess = ({ fileId, isPrivate }) => {
  const [downloadCode, setDownloadCode] = useState('');
  const [error, setError] = useState(null);

  const handleDownload = async () => {
    try {
      const url = `/api/files/${fileId}`;
      const params = isPrivate ? `?download_code=${downloadCode}` : '';
      
      const response = await axios.get(`${url}${params}`, {
        responseType: 'blob',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // 创建下载链接
      const downloadUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = response.headers['content-disposition'].split('filename=')[1];
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setError('访问被拒绝，请检查下载码是否正确');
    }
  };

  return (
    <div>
      {isPrivate && (
        <div>
          <input
            type="text"
            maxLength={4}
            value={downloadCode}
            onChange={(e) => setDownloadCode(e.target.value)}
            placeholder="请输入4位下载码"
          />
        </div>
      )}
      <button onClick={handleDownload}>
        下载文件
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};
```

### 4.4 文件分享功能

1. 后端分享功能实现：
```python
# main.py
@router.post("/files/{file_id}/share")
def generate_share_link(
    file_id: int,
    current_user: User = Depends(get_current_user)
):
    file_info = get_file_by_id(file_id)
    if not file_info or file_info.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权分享此文件")
    
    # 生成分享链接
    share_token = generate_share_token(file_id)
    share_url = f"{BASE_URL}/share/{share_token}"
    
    return {
        "share_url": share_url,
        "download_code": file_info.download_code if file_info.is_private else None
    }

@router.get("/share/{share_token}")
def access_shared_file(
    share_token: str,
    download_code: str = None
):
    try:
        file_id = verify_share_token(share_token)
        file_info = get_file_by_id(file_id)
        
        if not file_info:
            raise HTTPException(status_code=404, detail="文件不存在")
        
        if file_info.is_private and file_info.download_code != download_code:
            raise HTTPException(status_code=403, detail="下载码错误")
        
        return FileResponse(
            os.path.join(UPLOAD_DIR, file_info.filepath),
            filename=file_info.filename
        )
    except:
        raise HTTPException(status_code=400, detail="无效的分享链接")
```

2. 前端分享功能实现：
```jsx
// ShareFile.jsx
const ShareFile = ({ fileId, isPrivate, downloadCode }) => {
  const [shareUrl, setShareUrl] = useState('');
  const [showShareInfo, setShowShareInfo] = useState(false);

  const generateShareLink = async () => {
    try {
      const response = await axios.post(
        `/api/files/${fileId}/share`,
        {},
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );
      
      setShareUrl(response.data.share_url);
      setShowShareInfo(true);
    } catch (error) {
      console.error('生成分享链接失败:', error);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('已复制到剪贴板'))
      .catch(err => console.error('复制失败:', err));
  };

  return (
    <div className="share-container">
      <button onClick={generateShareLink}>
        生成分享链接
      </button>
      
      {showShareInfo && (
        <div className="share-info">
          <div>
            <p>分享链接：</p>
            <div className="url-container">
              <input type="text" value={shareUrl} readOnly />
              <button onClick={() => copyToClipboard(shareUrl)}>
                复制链接
              </button>
            </div>
          </div>
          
          {isPrivate && (
            <div className="download-code">
              <p>下载码：{downloadCode}</p>
              <button onClick={() => copyToClipboard(downloadCode)}>
                复制下载码
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ShareAccess.jsx
const ShareAccess = () => {
  const { share_token } = useParams();
  const [downloadCode, setDownloadCode] = useState('');
  const [error, setError] = useState(null);

  const accessSharedFile = async () => {
    try {
      const url = `/api/share/${share_token}`;
      const params = downloadCode ? `?download_code=${downloadCode}` : '';
      
      const response = await axios.get(`${url}${params}`, {
        responseType: 'blob'
      });
      
      // 处理文件下载
      const downloadUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = response.headers['content-disposition'].split('filename=')[1];
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      setError('访问失败，请检查下载码是否正确');
    }
  };

  return (
    <div className="share-access">
      <h2>访问分享文件</h2>
      <div>
        <input
          type="text"
          maxLength={4}
          value={downloadCode}
          onChange={(e) => setDownloadCode(e.target.value)}
          placeholder="请输入下载码（如果需要）"
        />
      </div>
      <button onClick={accessSharedFile}>
        下载文件
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};
```

## 5. 安全性考虑

### 5.1 用户认证

- 使用JWT进行身份验证
- 密码加密存储
- 登录状态管理
- Token失效处理

### 5.2 文件访问控制

- 私密文件下载码保护
- 文件所有者权限控制
- 防止未授权访问

### 5.3 其他安全措施

- CORS配置
- 文件类型验证
- 文件大小限制
- SQL注入防护

## 6. 部署说明

### 6.1 环境要求

- Python 3.7+
- Node.js 14+
- SQLite 3

### 6.2 安装步骤

1. 后端设置：
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. 前端设置：
   ```bash
   cd frontend
   npm install
   ```

### 6.3 启动服务

1. 后端服务：
   ```bash
   python main.py
   ```

2. 前端服务：
   ```bash
   npm run dev
   ```

## 7. 后续优化建议

1. 功能增强：
   - 批量操作功能
   - 文件夹支持
   - 在线解压缩
   - 文件版本控制

2. 性能优化：
   - 大文件分片上传
   - 文件缓存机制
   - 异步处理优化

3. 安全增强：
   - 文件加密存储
   - 更细粒度的权限控制
   - 防盗链措施

4. 用户体验：
   - 拖拽排序
   - 更多预览格式支持
   - 移动端适配优化

## 8. 维护指南

### 8.1 日常维护

- 定期检查日志
- 清理临时文件
- 数据库备份
- 性能监控

### 8.2 故障排除

1. 文件上传失败：
   - 检查文件大小限制
   - 验证存储空间
   - 检查权限设置

2. 预览功能异常：
   - 检查文件格式支持
   - 验证字体配置
   - 检查转换服务

3. 认证问题：
   - 检查Token配置
   - 验证数据库连接
   - 检查用户状态

### 8.3 代码维护

- 遵循代码规范
- 完善注释文档
- 单元测试覆盖
- 版本控制管理

## 9. 结语

本文档详细描述了个人网盘项目的技术实现和架构设计。开发团队应该仔细阅读并理解这些内容，以确保能够顺利接手和维护项目。如有任何问题，请及时与项目负责人沟通。