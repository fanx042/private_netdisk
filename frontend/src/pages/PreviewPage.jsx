import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Form, Modal, message, Space, Typography } from 'antd';
import { DownloadOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import axios from 'axios';

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

  // 复制文本到剪贴板的通用函数
  const copyToClipboard = (text) => {
    // 创建一个临时的textarea元素
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // 防止页面滚动
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    
    try {
      // 选择文本
      textarea.select();
      textarea.setSelectionRange(0, 99999); // 兼容移动设备
      
      // 尝试使用新API
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
          .then(() => {
            message.success('复制成功');
          })
          .catch(() => {
            // 如果新API失败，回退到document.execCommand
            const successful = document.execCommand('copy');
            if (successful) {
              message.success('复制成功');
            } else {
              message.error('复制失败，请手动复制');
            }
          });
      } else {
        // 在不支持新API的环境中使用旧方法
        const successful = document.execCommand('copy');
        if (successful) {
          message.success('复制成功');
        } else {
          message.error('复制失败，请手动复制');
        }
      }
    } catch (err) {
      console.error('Copy failed:', err);
      message.error('复制失败，请手动复制');
    } finally {
      // 清理临时元素
      document.body.removeChild(textarea);
    }
  };

  // 获取文件基本信息
  useEffect(() => {
    const fetchFileInfo = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/files/${fileId}/info`);
        setFileInfo(response.data);
        
        // 如果URL中有下载码，自动填入表单
        if (downloadCode) {
          downloadForm.setFieldsValue({ downloadCode });
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
  const handlePreview = async (inputCode = null) => {
    try {
      setLoading(true);
      let url = `/api/files/${fileId}/preview`;
      
      // 使用输入的下载码或保存的下载码
      const code = inputCode || savedDownloadCode;
      if (code) {
        url += `?download_code=${code}`;
        // 保存有效的下载码以便后续使用
        setSavedDownloadCode(code);
      }

      const response = await axios({
        url,
        method: 'GET',
        responseType: 'blob'
      });

      // 创建预览窗口
      const fileType = response.headers['content-type'];
      const blob = new Blob([response.data], { type: fileType });
      const fileUrl = URL.createObjectURL(blob);

      // 根据文件类型选择预览方式
      if (fileType === 'text/plain') {
        // 文本文件
        const reader = new FileReader();
        reader.onload = function (e) {
          Modal.info({
            title: '文件预览',
            width: '80%',
            content: (
              <pre style={{
                maxHeight: '60vh',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {e.target.result}
              </pre>
            ),
          });
        };
        reader.readAsText(blob);
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
        // PDF文件
        window.open(fileUrl, '_blank');
      }

      // 清理URL
      setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
      }, 100);

    } catch (error) {
      if (error.response?.status === 403) {
        setCodeModalVisible(true);
      } else {
        message.error('文件预览失败');
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
      
      // 使用输入的下载码或保存的下载码
      const code = inputCode || savedDownloadCode;
      if (code) {
        url += `?download_code=${code}`;
        // 保存有效的下载码以便后续使用
        setSavedDownloadCode(code);
      }

      const response = await axios({
        url,
        method: 'GET',
        responseType: 'blob'
      });

      // 创建下载链接
      const blob = new Blob([response.data]);
      const fileUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // 从响应头中获取文件名
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'download';
      
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/);
        if (matches) {
          filename = decodeURIComponent(matches[1] || matches[2] || matches[3]);
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
      if (error.response?.status === 403) {
        setCodeModalVisible(true);
      } else {
        message.error('文件下载失败');
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
      <Card loading={loading && !fileError}>
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
                <Text type="warning" style={{ fontSize: '16px', marginLeft: '12px' }}>
                  (私密文件)
                </Text>
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
              <Space>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setIsPreviewMode(true);
                    if (fileInfo?.is_private && !savedDownloadCode) {
                      setCodeModalVisible(true);
                    } else {
                      handlePreview();
                    }
                  }}
                  loading={loading}
                >
                  预览文件
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    setIsPreviewMode(false);
                    if (fileInfo?.is_private && !savedDownloadCode) {
                      setCodeModalVisible(true);
                    } else {
                      handleDownload();
                    }
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
                    <Text>这是一个私密文件，您需要输入下载码才能访问。</Text>
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
        onCancel={() => setCodeModalVisible(false)}
        okText={isPreviewMode ? "预览" : "下载"}
        cancelText="取消"
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