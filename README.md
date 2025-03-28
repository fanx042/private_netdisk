# 私人网盘应用(Fully contributed by [文心快码](https://comate.baidu.com/zh))

这是一个基于 FastAPI 和 React 的私人网盘应用，提供安全可靠的文件存储、分享和管理功能。支持文件拖拽上传、私密文件保护、文件在线预览等特性。

本项目所有的文件，包括代码、配置文件、脚本、gitignore等完全由文心快码生成，没有做任何修改。

使用的提示词如下（提示词由B站up主[CodeSheep](https://space.bilibili.com/384068749)提供的基础提示词修改）：

```
我需要在当前项目下实现一个私人网盘应用，应用使用前后端分离的架构。

后端部分要求：
1.代码放置在backend目录下
2.使用python语言，fastapi框架提供一个API服务
3.支持文件的上传、列表、下载功能
4.上传的文件存放在当前目录下
5.具有用户登录、注册功能
6.每位用户可以上传自己的文件，并且可以将文件设置为私密，设置为私密的文件需要创建4位下载码，
7.每位用户在自己的空间中都能看到所有用户上传的文件（包括私密）


前端部分要求：
1.代码放置在frontend目录下
2.使用标准的React+Vite的应用结构
3.使用antd作为组件库，react-query管理请求
4.首页内容分为3部分，顶部应用标题”我的盘”；中部副标题“最近上传”，显示最近上传的10个文件，分为2行放置，每行5个文件等宽；下方副标题”上传文件”，提供一个上传框，支持单文件上传，仅支持常见的文件格式
1. 文件上传后，列表会刷新并显示最新文件
6.每位用户都可以看到所有用户上传的文件，包括私密文件，
7.右上角显示当前用户名称，点击可以修改用户信息

注意：
1、请创建完整的应用，并在scripts目录下创建运行前端与后端部分的2个Shell脚本
2、编写详细的README.md文件，
3、所有的配置和命令均按照Windows操作系统格式完成，尤其是命令行
4.下载码可以随机生成，也可以手动设置
5.在自己的用户空间中可以看到自己的私密文件的下载码，其他用户则不可见
```

## 功能特性

### 用户系统
- 用户注册与登录（JWT认证）
- 个人信息管理
- 用户权限控制

### 文件管理
- 支持拖拽上传和点击上传
- 文件下载与删除
- 文件列表展示与排序
- 支持批量文件上传
- 上传进度实时显示
- 支持常见文件格式

### 隐私保护
- 私密文件设置
- 自定义4位下载码保护
- 文件访问权限控制
- 仅文件所有者可见下载码

### 用户界面
- 响应式布局设计
- 直观的拖放上传区域
- 文件上传进度显示
- 友好的错误提示
- 操作确认对话框

## 技术栈

### 后端技术
- **Python 3.8+**: 核心编程语言
- **FastAPI**: 高性能异步Web框架
- **SQLite**: 轻量级数据库
- **SQLAlchemy**: ORM框架
- **JWT**: 用户认证
- **Python-Multipart**: 文件上传处理
- **uvicorn**: ASGI服务器

### 前端技术
- **React 18**: 用户界面框架
- **Vite**: 构建工具
- **Ant Design 5**: UI组件库
- **React Query**: 服务端状态管理
- **Axios**: HTTP客户端
- **React Router**: 路由管理
- **Context API**: 状态管理

## 项目结构

```
.
├── backend/                 # 后端应用
│   ├── uploads/            # 文件上传目录
│   ├── auth.py            # 认证相关
│   ├── database.py        # 数据库配置
│   ├── main.py           # 应用入口
│   ├── models.py         # 数据模型
│   ├── schemas.py        # 数据验证
│   └── requirements.txt   # 依赖清单
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── contexts/     # 上下文
│   │   ├── pages/       # 页面
│   │   └── App.jsx      # 主应用
│   ├── package.json     # 依赖配置
│   └── vite.config.js   # Vite配置
└── scripts/              # 启动脚本
```

## 环境要求

### 系统要求
- Linux/Windows/macOS 操作系统
- 4GB及以上内存
- 1GB以上可用磁盘空间

### 软件要求
- Python 3.8 或更高版本
- Node.js 16 或更高版本
- npm 8 或更高版本
- Conda（推荐使用Miniconda）

## 环境检查和准备

项目提供了环境检查脚本，可以帮助您验证和准备开发环境：

```bash
# 添加脚本执行权限
chmod +x scripts/*.sh

# 运行环境检查脚本
./scripts/check_environment.sh
```

环境检查脚本会检查以下内容：
1. Node.js 版本及其包管理器
2. Python 版本
3. Conda 环境（特别是"disk"环境）
4. 后端关键依赖包的状态
5. 提供详细的问题修复建议

## 详细安装步骤

### 1. 克隆项目
```bash
git clone <项目地址>
cd netdisk
```

### 2. 后端设置

后端使用 Conda 管理 Python 虚拟环境，启动脚本会自动完成以下操作：

1. 检查并安装 Conda（如果未安装）
2. 创建或激活 "disk" 虚拟环境（Python 3.8）
3. 安装项目依赖
4. 创建必要的目录结构
5. 启动 FastAPI 服务

### 3. 前端设置

前端环境配置会在启动脚本中自动完成：

1. 检查并安装 nvm（Node Version Manager）
2. 安装并使用 Node.js 16
3. 清理并重新安装依赖
4. 启动 Vite 开发服务器

## 启动应用

### 方法一：使用启动脚本（推荐）

项目提供了Windows和Linux/macOS两套启动脚本。

#### Windows系统：

使用集成脚本一键启动所有服务：
```cmd
# 普通启动
scripts\start_all.bat

# 更新依赖模式启动（清理并重新安装所有依赖）
scripts\start_all.bat --update-deps
```

或者分别启动各个服务：

1. 启动后端服务：
```cmd
scripts\start_backend.cmd
```

2. 启动前端服务：
```cmd
# 普通启动
scripts\start_frontend.cmd

# 更新依赖模式启动
scripts\start_frontend.cmd --update-deps
```

Windows脚本特性：
- 自动检查并创建conda环境
- 自动检查Node.js版本要求
- 支持依赖更新模式
- 后端日志自动保存在backend/logs目录
- 优雅的服务停止处理

#### Linux/macOS系统：

使用集成脚本一键启动所有服务：
```bash
# 添加执行权限
chmod +x scripts/*.sh

# 启动所有服务
./scripts/start_all.sh
```

或者分别启动各个服务：

1. 启动后端服务：
```bash
./scripts/start_backend.sh
```

2. 启动前端服务：
```bash
./scripts/start_frontend.sh
```

### 方法二：手动启动

1. 启动后端服务：
```bash
cd backend
source $(conda info --base)/etc/profile.d/conda.sh
conda activate disk
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2. 启动前端服务：
```bash
cd frontend
nvm use 16  # 如果已安装nvm
npm install
npm run dev
```

### 验证服务状态

启动完成后：
- 后端API服务运行在：http://localhost:8000
- 前端开发服务器运行在：http://localhost:5173
- 可以访问 http://localhost:8000/docs 查看API文档

## 配置说明

### 后端配置

1. 文件上传配置（main.py）：
```python
# 上传文件大小限制
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# 支持的文件类型
ALLOWED_EXTENSIONS = {
    '.txt', '.pdf', '.doc', '.docx', 
    '.xls', '.xlsx', '.jpg', '.jpeg', 
    '.png', '.zip', '.rar'
}
```

2. 数据库配置（database.py）：
```python
# 数据库URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./netdisk.db"
```

3. JWT配置（auth.py）：
```python
# Token过期时间
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24小时
```

### 前端配置

1. API配置（vite.config.js）：
```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      changeOrigin: true
    }
  }
}
```

2. 上传配置（HomePage.jsx）：
```javascript
// 文件上传限制
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
```

## 使用指南

1. 访问应用：
   - 打开浏览器访问 http://localhost:5173
   - 首次使用需要注册账号

2. 文件上传：
   - 点击上传区域选择文件
   - 或直接将文件拖拽到上传区域
   - 支持批量上传
   - 可选择是否设置为私密文件

3. 私密文件：
   - 上传时可设置4位下载码
   - 仅文件所有者可见下载码
   - 其他用户下载需要输入正确的下载码

4. 文件管理：
   - 支持文件删除
   - 可查看文件上传时间、大小等信息
   - 文件列表支持排序和筛选

5. 用户管理：
   - 点击右上角用户名访问个人信息
   - 可修改用户信息
   - 可查看个人上传的文件列表

## 注意事项

1. 文件上传限制：
   - 单个文件大小限制为100MB
   - 支持的文件格式：txt, pdf, doc, docx, xls, xlsx, jpg, jpeg, png, zip, rar

2. 安全建议：
   - 定期更改密码
   - 重要文件建议设置为私密文件
   - 下载码请妥善保管

3. 性能优化：
   - 大文件上传时请保持网络稳定
   - 批量上传时建议控制在10个文件以内

4. 故障排除：
   - 上传失败时检查文件大小和格式
   - 下载失败时确认网络连接
   - 私密文件访问失败时检查下载码
   - Windows环境启动问题：
     * 如遇到conda环境问题，使用 `--update-deps` 参数重新安装依赖
     * 查看backend/logs目录下的日志文件定位后端问题
     * 确保已安装Python 3.8及Node.js 16或更高版本

## 开发计划

1. 近期计划：
   - [x] 添加文件在线预览功能
   - [ ] 支持文件夹上传
   - [x] 增加文件分享功能
   - [x] 添加文件搜索功能

2. 长期规划：
   - [ ] 支持更多文件格式
   - [ ] 添加文件版本控制
   - [ ] 实现文件协同编辑
   - [ ] 优化移动端体验

## 贡献指南

欢迎提交问题反馈和功能建议，也欢迎提交代码贡献。请确保：

1. 代码符合项目规范
2. 提供必要的测试用例
3. 更新相关文档
4. 提交清晰的PR描述

## 许可证

本项目采用 MIT 许可证