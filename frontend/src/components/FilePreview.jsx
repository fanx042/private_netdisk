import React from 'react';
import { Modal, message } from 'antd';
import axios from 'axios';

// 预览文件的通用组件
const FilePreview = {
  // 预览文件内容
  async previewFile(fileId, fileInfo, downloadCode = null) {
    try {
      // 构建API URL
      let apiUrl = `/api/files/${fileId}/preview`;
      if (downloadCode) {
        apiUrl += `?download_code=${downloadCode}`;
      }

      // 获取token（如果用户已登录）
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 获取文件内容
      const response = await axios.get(apiUrl, {
        headers,
        responseType: 'blob'
      });

      // 获取文件类型
      const fileType = response.headers['content-type'] || '';

      // 创建Blob URL用于预览
      const blob = new Blob([response.data], { type: fileType });
      const fileUrl = URL.createObjectURL(blob);

      // 根据文件类型选择不同的预览方式
      await this.showPreviewModal(fileType, blob, fileUrl, fileInfo);

      // 清理URL
      setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
      }, 100);

      return true;
    } catch (error) {
      console.error('预览文件失败:', error);
      if (error.response?.status === 403) {
        message.error('需要下载码访问此文件');
        return { needCode: true };
      } else if (error.response?.status === 404) {
        message.error('文件不存在或已被删除');
      } else if (error.response?.status === 400) {
        message.error(error.response?.data?.detail || '此文件类型不支持预览');
      } else {
        message.error('文件预览失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
      }
      return false;
    }
  },

  // 根据文件类型显示预览模态框
  async showPreviewModal(fileType, blob, fileUrl, fileInfo) {
    if (fileType === 'text/html') {
      await this.previewHtml(blob);
    } else if (fileType.startsWith('image/')) {
      this.previewImage(fileUrl);
    } else if (fileType === 'application/pdf') {
      this.previewPdf(fileUrl, fileInfo);
    } else {
      throw new Error('不支持预览此类型的文件');
    }
  },

  // 预览HTML内容
  async previewHtml(blob) {
    try {
      // 首先尝试 UTF-8
      let content = await this.readFileAsText(blob, 'UTF-8');

      // 如果内容看起来像乱码，尝试 GBK
      if (/[\ufffd\ufffe\uffff]/.test(content)) {
        try {
          content = await this.readFileAsText(blob, 'GBK');
        } catch (e) {
          console.warn('GBK encoding failed, falling back to UTF-8');
        }
      }

      // 检查是否是HTML内容
      if (content.trim().startsWith('<!DOCTYPE html>')) {
        // HTML内容 - 使用iframe展示
        Modal.info({
          title: 'HTML预览',
          width: '80%',
          content: (
            <div style={{ height: '60vh' }}>
              {React.createElement('div', {
                dangerouslySetInnerHTML: {
                  __html: `<iframe srcdoc="${encodeURIComponent(content)}" style="width:100%;height:60vh;border:none;"></iframe>`
                }
              })}
            </div>
          ),
        });
      } else {
        // 普通文本内容
        Modal.info({
          title: '文本预览',
          width: '80%',
          content: (
            <div>
              <pre style={{
                maxHeight: '60vh',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                backgroundColor: '#f5f5f5',
                padding: '15px',
                borderRadius: '4px',
                fontSize: '14px',
                lineHeight: '1.6',
                fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace'
              }}>
                {content}
              </pre>
            </div>
          ),
        });
      }
    } catch (error) {
      console.error('Error reading text file:', error);
      message.error('文件预览失败：无法正确读取文件内容');
    }
  },

  // 预览图片
  previewImage(fileUrl) {
    Modal.info({
      title: '图片预览',
      width: '80%',
      content: (
        <img
          src={fileUrl}
          alt="preview"
          style={{
            maxWidth: '100%',
            maxHeight: '60vh',
            objectFit: 'contain'
          }}
        />
      ),
    });
  },

  // 预览PDF
  previewPdf(fileUrl, fileInfo) {
    // 检查是否是由文本文件转换的PDF
    const isTextFile = fileInfo?.file_type === 'text/plain';
    const title = isTextFile ? '文本文件预览 (PDF格式)' : 'PDF预览';

    Modal.info({
      title: title,
      width: '90%',
      content: (
        <div style={{ height: '70vh' }}>
          <iframe
            src={fileUrl}
            width="100%"
            height="100%"
            title={title}
            style={{ border: 'none' }}
          />
        </div>
      ),
    });
  },

  // 读取文件内容为文本
  readFileAsText(blob, encoding) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        resolve(e.target.result);
      };
      reader.onerror = function (e) {
        reject(e);
      };
      reader.readAsText(blob, encoding);
    });
  }
};

export default FilePreview;