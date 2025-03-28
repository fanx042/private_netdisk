import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Form, Modal, message, Space, Typography, Tooltip, Badge, Statistic } from 'antd';
import { DownloadOutlined, EyeOutlined, CopyOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import axios from 'axios';
import FilePreview from '../components/FilePreview';
import { formatFileSize, copyToClipboard, downloadFile, fetchFileInfo } from '../utils/fileUtils';

const { Text, Title } = Typography;

function PreviewPage() {
  const { fileId } = useParams();
  const [searchParams] = useSearchParams();
  const downloadCode = searchParams.get('download_code');
  
  const [loading, setLoading] = useState(false);
  const [downloadForm] = Form.useForm();
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [savedDownloadCode, setSavedDownloadCode] = useState(downloadCode || '');

  // 使用 fileUtils 中的 copyToClipboard

  // 检查文件是否存在并可访问
  const checkFileExists = async (url, headers = {}) => {
    try {
      await axios.head(url, { headers });
      return true;
    } catch (error) {
      return false;
    }
  };

  // 获取文件基本信息
  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        setLoading(true);
        let url = `/api/files/${fileId}/info`;

        // 获取token（如果用户已登录）
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // 首先尝试获取基本信息，不带下载码
        const response = await axios.get(url, { headers });

        // 调试信息，查看API返回的数据结构
        console.log('File info response:', response.data);

        // 如果是私密文件且有下载码，再次请求以获取完整信息
        if (response.data.is_private && downloadCode) {
          const fullResponse = await axios.get(`${url}?download_code=${downloadCode}`, { headers });
          console.log('Full file info with download code:', fullResponse.data);
          setFileInfo(fullResponse.data);
          setSavedDownloadCode(downloadCode);
          downloadForm.setFieldsValue({ downloadCode });
        } else {
          setFileInfo(response.data);
        }
        setFileInfo(response.data);
        
        // 如果URL中有下载码，保存它以便后续使用
        if (downloadCode) {
          downloadForm.setFieldsValue({ downloadCode });
          setSavedDownloadCode(downloadCode);
        }
      } catch (error) {
        console.error('获取文件信息失败', error);
        if (error.response?.status === 404) {
          setFileError('文件不存在或已被删除');
        } else {
          setFileError('获取文件信息失败');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchFileInfo();
  }, [fileId, downloadCode, downloadForm]);

  // 处理文件预览
  const handlePreview = async () => {
    if (!fileInfo) return;

    try {
      setLoading(true);
      
      // 如果是私密文件且没有下载码
      if (fileInfo.is_private && !savedDownloadCode) {
        setIsPreviewMode(true);
        setCodeModalVisible(true);
        setLoading(false);
        return;
      }

      // 构建API URL
      let apiUrl = `/api/files/${fileId}/preview`;
      if (savedDownloadCode) {
        apiUrl += `?download_code=${savedDownloadCode}`;
      }

      // 获取token（如果用户已登录）
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

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
      // 注意：文本文件现在会在后端转换为PDF，所以这里的fileType会是application/pdf
      if (fileType === 'text/html') {
        // HTML文件 - 尝试多种编码
        const tryReadWithEncoding = (encoding) => {
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
        };

        try {
          // 首先尝试 UTF-8
          let content = await tryReadWithEncoding('UTF-8');

          // 如果内容看起来像乱码，尝试 GBK
          if (/[\ufffd\ufffe\uffff]/.test(content)) {
            try {
              content = await tryReadWithEncoding('GBK');
            } catch (e) {
              console.warn('GBK encoding failed, falling back to UTF-8');
            }
          }

          // 检查是否是HTML内容
          if (fileType === 'text/html' || content.trim().startsWith('<!DOCTYPE html>')) {
          // HTML内容 - 使用iframe展示
            Modal.info({
              title: '文件预览',
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
              title: '文件预览',
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
      } else if (fileType.startsWith('image/')) {
        // 图片文件
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
      } else if (fileType === 'application/pdf') {
        // PDF文件 - 使用内嵌iframe而不是新窗口，避免被浏览器阻止
        const isTextFile = fileInfo.file_type === 'text/plain';
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
      }

      // 清理URL
      setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
      }, 100);

    } catch (error) {
      console.error('预览文件失败:', error);
      if (error.response?.status === 403) {
        message.error('需要下载码访问此文件');
        setCodeModalVisible(true);
      } else if (error.response?.status === 404) {
        message.error('文件不存在或已被删除');
      } else if (error.response?.status === 400) {
        message.error(error.response?.data?.detail || '此文件类型不支持预览');
      } else if (error.code === 'ECONNABORTED') {
        message.error('预览请求超时，请稍后重试');
      } else {
        message.error('文件预览失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理文件下载
  const handleDownload = async (inputCode = null) => {
    try {
      setLoading(true);
      let url = `/api/files/${fileId}`;
      
      // 如果是私密文件且没有下载码
      if (fileInfo.is_private && !savedDownloadCode && !inputCode) {
        setIsPreviewMode(false);
        setCodeModalVisible(true);
        setLoading(false);
        return;
      }

      // 如果有下载码（输入的或保存的），添加到URL
      const code = inputCode || savedDownloadCode;
      if (code) {
        url += `?download_code=${code}`;
        // 保存有效的下载码以便后续使用
        setSavedDownloadCode(code);
      }

      // 获取认证token（如果有）
      const token = localStorage.getItem('token');
      const headers = {
        'Accept-Language': 'zh-CN', // 请求中文文件名
      };

      // 如果有token，添加到请求头中
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // 注意：下载码应该作为URL参数传递，而不是请求头

      const response = await axios({
        url,
        method: 'GET',
        responseType: 'blob',
        timeout: 30000, // 设置30秒超时
        validateStatus: function (status) {
          return status >= 200 && status < 300;
        },
        headers: headers
      });

      // 创建下载链接
      const blob = new Blob([response.data]);
      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // 从响应头中获取文件名
      const contentDisposition = response.headers['content-disposition'];
      let filename = fileInfo?.filename || 'download'; // 优先使用已知的文件名
      
      if (contentDisposition) {
        try {
        // 尝试解析 Content-Disposition 头
          const matches = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/);
          if (matches) {
            const rawFilename = matches[1] || matches[2] || matches[3];
            // 处理 UTF-8 编码的文件名
            if (matches[1]) {
              filename = decodeURIComponent(rawFilename);
            } else {
              // 处理其他编码的文件名
              try {
                filename = decodeURIComponent(rawFilename);
              } catch (e) {
                // 如果解码失败，尝试使用 unescape
                filename = unescape(rawFilename);
              }
            }
          }
        } catch (e) {
          console.warn('解析文件名失败:', e);
          // 如果解析失败，使用默认文件名
          filename = fileInfo?.filename || 'download';
        }
      }
      
      link.href = fileUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(fileUrl);
      
      message.success('文件下载成功');
    } catch (error) {
      console.error('下载文件失败:', error);
      if (error.response?.status === 403) {
        message.error('需要下载码访问此文件');
        setCodeModalVisible(true);
      } else if (error.response?.status === 404) {
        message.error('文件不存在或已被删除');
      } else if (error.code === 'ECONNABORTED') {
        message.error('下载请求超时，请稍后重试');
      } else {
        message.error('文件下载失败: ' + (error.response?.data?.detail || error.message || '未知错误'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理下载码提交
  const handleCodeSubmit = () => {
    downloadForm.validateFields().then((values) => {
      if (isPreviewMode) {
        handlePreview(values.downloadCode);
      } else {
        handleDownload(values.downloadCode);
      }
      setCodeModalVisible(false);
      downloadForm.resetFields();
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
      <Card loading={loading && !fileError} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        {fileError ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Title level={4} type="danger">{fileError}</Title>
            <Text type="secondary">请检查链接是否正确或联系文件所有者</Text>
          </div>
        ) : (
          <>
            <Title level={3}>
              {fileInfo?.filename || '文件分享'}
              {fileInfo?.is_private && (
                  <Tooltip title="需要下载码才能预览或下载">
                    <Text type="warning" style={{ fontSize: '16px', marginLeft: '12px' }}>
                      (私密文件)
                    </Text>
                  </Tooltip>
              )}
            </Title>
            
            {fileInfo && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">上传者: {fileInfo.uploader || '未知'}</Text>
                {fileInfo.upload_time && (
                  <Text type="secondary" style={{ marginLeft: 16 }}>
                    上传时间: {new Date(fileInfo.upload_time).toLocaleString()}
                  </Text>
                )}
              </div>
            )}
            
            <Space direction="vertical" size="large" style={{ width: '100%', marginTop: 24 }}>
                {fileInfo && (
                  <div style={{ backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Space direction="vertical" size="small">
                        <Text><strong>文件大小:</strong> {fileInfo.file_size ? formatFileSize(fileInfo.file_size) : '未知'}</Text>
                        <Text><strong>文件类型:</strong> {fileInfo.file_type || '未知'}</Text>
                      </Space>
                      {fileInfo.download_count !== undefined && (
                        <Badge count={fileInfo.download_count} overflowCount={9999} style={{ backgroundColor: '#52c41a' }}>
                          <Card size="small" style={{ width: 100, textAlign: 'center' }}>
                            <Statistic
                              title="下载"
                              value={fileInfo.download_count}
                              prefix={<CloudDownloadOutlined />}
                              valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                            />
                          </Card>
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              <Space>
                  <Tooltip title={!fileInfo?.can_preview ? "此文件类型不支持预览" : ""}>
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        setIsPreviewMode(true);
                        handlePreview();
                      }}
                      loading={loading}
                      disabled={!fileInfo?.can_preview}
                    >
                      预览文件
                    </Button>
                  </Tooltip>
                <Button
                    type="default"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    setIsPreviewMode(false);
                    handleDownload();
                  }}
                  loading={loading}
                >
                  下载文件
                </Button>
                
                {savedDownloadCode && (
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      setSavedDownloadCode('');
                      message.info('已清除下载码');
                    }}
                  >
                    清除下载码
                  </Button>
                )}
              </Space>
              
              {fileInfo?.is_private ? (
                <div style={{ backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4 }}>
                  {savedDownloadCode ? (
                    <Space direction="vertical">
                      <Text strong>当前使用的下载码:</Text>
                      <Space>
                        <Text code>{savedDownloadCode}</Text>
                        <Button 
                          size="small" 
                          type="text" 
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(savedDownloadCode)}
                        >
                          复制
                        </Button>
                      </Space>
                    </Space>
                  ) : (
                        <Text>这是一个私密文件，预览或下载时需要输入下载码。</Text>
                  )}
                </div>
              ) : (
                <Text type="secondary">这是一个公开文件，您可以直接预览或下载。</Text>
              )}
            </Space>
          </>
        )}
      </Card>

      <Modal
        title="输入下载码"
        open={codeModalVisible}
        onOk={handleCodeSubmit}
        onCancel={() => {
          setCodeModalVisible(false);
        }}
        okText={isPreviewMode ? "预览" : "下载"}
        cancelText="取消"
        maskClosable={false} // 防止用户点击蒙层关闭
        closable={!!fileInfo} // 只有在已经获取到文件信息后才允许关闭
      >
        <div style={{ marginBottom: 16 }}>
          <Text>这是一个私密文件，请输入下载码继续访问</Text>
        </div>
        <Form form={downloadForm}>
          <Form.Item
            name="downloadCode"
            rules={[
              { required: true, message: '请输入下载码' },
              { len: 4, message: '下载码必须是4位' }
            ]}
          >
            <Input 
              placeholder="请输入4位下载码" 
              maxLength={4} 
              autoFocus
              onPressEnter={handleCodeSubmit}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default PreviewPage;