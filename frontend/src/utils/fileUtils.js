import axios from 'axios';
import { message } from 'antd';

// 格式化文件大小
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 复制文本到剪贴板
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      message.success('复制成功');
    } else {
      // 回退方案
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        message.success('复制成功');
      } else {
        throw new Error('复制失败');
      }
    }
  } catch (err) {
    console.error('Copy failed:', err);
    message.error('复制失败，请手动复制');
  }
};

// 从Content-Disposition中提取文件名
export const extractFilename = (contentDisposition, defaultName = 'download') => {
  if (!contentDisposition) return defaultName;
  
  try {
    // 首先尝试获取 filename* 参数（RFC 5987）
    const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (filenameStarMatch) {
      return decodeURIComponent(filenameStarMatch[1]);
    }
    
    // 如果没有 filename*，尝试普通 filename
    const filenameMatch = contentDisposition.match(/filename=\"([^\"]+)\"|filename=([^;]+)/);
    if (filenameMatch) {
      return decodeURIComponent(filenameMatch[1] || filenameMatch[2]);
    }
  } catch (e) {
    console.warn('解析文件名失败:', e);
  }
  
  return defaultName;
};

// 检查文件是否可预览
export const isFilePreviewable = (fileType) => {
  return ['text/plain', 'image/jpeg', 'image/png', 'application/pdf'].includes(fileType);
};

// 获取文件信息
export const fetchFileInfo = async (fileId, downloadCode = null) => {
  let url = `/api/files/${fileId}/info`;
  if (downloadCode) {
    url += `?download_code=${downloadCode}`;
  }
  
  const token = localStorage.getItem('token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  const response = await axios.get(url, { headers });
  return response.data;
};

// 下载文件
export const downloadFile = async (fileId, downloadCode = null, filename = null) => {
  let url = `/api/files/${fileId}`;

  if (downloadCode) {
    url += `?download_code=${downloadCode}`;
  }
  
  // console.log('downloadCode:', url);
  const token = localStorage.getItem('token');
  const headers = {
    'Accept-Language': 'zh-CN',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'blob',
    timeout: 30000,
    headers
  });
  
  // 获取文件名
  const actualFilename = filename || extractFilename(
    response.headers['content-disposition'],
    'download'
  );
  
  // 创建下载链接
  const blob = new Blob([response.data]);
  const fileUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = fileUrl;
  link.setAttribute('download', actualFilename);
  document.body.appendChild(link);
  link.click();
  
  // 清理
  document.body.removeChild(link);
  URL.revokeObjectURL(fileUrl);
  
  return response;
};