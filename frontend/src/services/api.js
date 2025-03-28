import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 认证相关API
export const authAPI = {
  // 登录
  login: async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/login', formData);
    return response.data;
  },

  // 注册
  register: async (username, password) => {
    const response = await api.post('/register', { username, password });
    return response.data;
  },

  // 获取当前用户信息
  getCurrentUser: async () => {
    const response = await api.get('/user/me');
    return response.data;
  },

  // 登出
  logout: async () => {
    const response = await api.post('/logout', {});
    return response.data;
  },

  // 修改密码
  updatePassword: async (newPassword) => {
    const response = await api.put('/user/me', { new_password: newPassword });
    return response.data;
  }
};

// 文件相关API
export const fileAPI = {
  // 获取文件列表
  getFiles: async () => {
    const response = await api.get('/files');
    return response.data;
  },

  // 上传文件
  uploadFile: async (file, isPrivate = false, downloadCode = null) => {
    const formData = new FormData();
    formData.append('file', file);
    
    if (isPrivate) {
      formData.append('is_private', 'true');
    }
    
    if (downloadCode) {
      formData.append('download_code', downloadCode);
    }
    
    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // 删除文件
  deleteFile: async (fileId) => {
    const response = await api.delete(`/files/${fileId}`);
    return response.data;
  },

  // 获取文件信息
  getFileInfo: async (fileId, downloadCode = null) => {
    let url = `/files/${fileId}/info`;
    if (downloadCode) {
      url += `?download_code=${downloadCode}`;
    }
    const response = await api.get(url);
    return response.data;
  },

  // 下载文件
  downloadFile: async (fileId, downloadCode = null) => {
    let url = `/files/${fileId}`;
    if (downloadCode) {
      url += `?download_code=${downloadCode}`;
    }
    
    const response = await api({
      url,
      method: 'GET',
      responseType: 'blob',
    });
    
    return response;
  },

  // 预览文件
  previewFile: async (fileId, downloadCode = null) => {
    let url = `/files/${fileId}/preview`;
    if (downloadCode) {
      url += `?download_code=${downloadCode}`;
    }
    
    const response = await api.get(url, {
      responseType: 'blob'
    });
    
    return response;
  },

  // 生成分享链接
  generateShareLink: async (fileId) => {
    const response = await api.post(`/files/${fileId}/share`);
    return response.data;
  }
};

export default api;