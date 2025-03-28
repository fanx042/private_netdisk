import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Upload, message,
  Card, Switch, Input,
  Modal, Form, Space, Typography,
  Tag, Tooltip, Badge,
} from 'antd';  
// UI Components and Icons

import {
  UploadOutlined, DownloadOutlined, KeyOutlined,
  DeleteOutlined, InboxOutlined, EyeOutlined,
  SearchOutlined, ShareAltOutlined, CloudDownloadOutlined,
} from '@ant-design/icons';

import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import FilePreview from '../components/FilePreview';
import { formatFileSize, copyToClipboard, downloadFile } from '../utils/fileUtils';

// Typography是antd库中的一个文字排版组件，提供了一系列用于文本展示的子组件，如Text、Title、Paragraph等，用于更好地控制文本的样式和排版。
const { Text, Paragraph } = Typography; 
// Dragger是Upload组件的一个子组件，专门用于实现拖拽上传的功能。通过拖拽文件到指定区域，触发文件上传操作。
const { Dragger } = Upload;  

function HomePage() {
  const { user } = useAuth();
  const [isPrivate, setIsPrivate] = useState(false);
  const [downloadCode, setDownloadCode] = useState('');
  const [downloadModalVisible, setDownloadModalVisible] = useState(false);
  const [currentFileId, setCurrentFileId] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [downloadForm] = Form.useForm();
  const queryClient = useQueryClient();
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [currentShareLink, setCurrentShareLink] = useState('');
  const [currentShareFile, setCurrentShareFile] = useState(null);

  // 获取文件列表
  const { data: files, isLoading } = useQuery({
    queryKey: ['files'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/files', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
  });

  // 删除文件
  const deleteMutation = useMutation({
    mutationFn: async (fileId) => {
      const token = localStorage.getItem('token');
      return await axios.delete(`/api/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      message.success('文件删除成功');
      queryClient.invalidateQueries(['files']);
    },
    onError: (error) => {
      message.error(error.response?.data?.detail || '文件删除失败');
    },
  });

  // 处理删除
  const handleDelete = (fileId) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个文件吗？此操作不可恢复。',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        deleteMutation.mutate(fileId);
      },
    });
  };

  // 上传文件
  const uploadMutation = useMutation({
    mutationFn: async (formData) => {
      const token = localStorage.getItem('token');
      return await axios.post('/api/files/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
    },
    onSuccess: () => {
      message.success('文件上传成功');
      queryClient.invalidateQueries(['files']);
    },
    onError: (error) => {
      message.error(error.response?.data?.detail || '文件上传失败');
    },
  });

  // 处理上传
  const handleUpload = (info) => {
    const formData = new FormData();
    formData.append('file', info.file);
    formData.append('is_private', isPrivate);
    if (isPrivate && downloadCode) {
      formData.append('download_code', downloadCode);
    }
    
    // 设置上传进度和状态
    info.onProgress({ percent: 0 });
    
    uploadMutation.mutate(formData, {
      onSuccess: () => {
        info.onProgress({ percent: 100 });
        info.onSuccess();
      },
      onError: (error) => {
        info.onError(error);
      }
    });
  };

  // 处理下载
  const handleDownload = async (fileId, isPrivateFile, fileDownloadCode, inputCode = null) => {
    try {
      const code = inputCode || fileDownloadCode;
      if (isPrivateFile && !code) {
        setCurrentFileId(fileId);
        setDownloadModalVisible(true);
        return;
      };

      await downloadFile(fileId, code);

      message.success('下载成功');
    } catch (error) {
      message.error('下载失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 处理文件预览
  const handlePreview = async (fileId, isPrivateFile, fileDownloadCode, inputCode = null) => {
    try {
      let url = `/api/files/${fileId}/preview`;
      // 使用传入的下载码或已有的下载码
      const code = inputCode || fileDownloadCode;
      if (isPrivateFile && !code) {
        // 如果是私密文件且没有下载码，显示输入下载码的对话框
        setCurrentFileId(fileId);
        setDownloadModalVisible(true);
        // 标记当前操作为预览模式
        setIsPreviewMode(true);
        return;
      }

      if (code) {
        url += `?download_code=${code}`;
      }
      // 如果用户已登录，添加认证头
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // 发起请求获取文件内容
      const response = await axios({
        url,
        method: 'GET',
        headers,
        responseType: 'blob'
      });

      // 创建预览窗口
      const fileType = response.headers['content-type'];
      const blob = new Blob([response.data], { type: fileType });
      const fileUrl = URL.createObjectURL(blob);

      // 根据文件类型选择预览方式
      // 注意：文本文件现在会在后端转换为PDF，所以这里的fileType会是application/pdf
      if (fileType === 'text/html') {
      // HTML文件
        const reader = new FileReader();
        reader.onload = function (e) {
          // 创建iframe展示HTML内容
          Modal.info({
            title: 'HTML预览',
            width: '90%',
            content: (
              <div style={{ height: '70vh' }}>
                {React.createElement('div', {
                  dangerouslySetInnerHTML: { __html: `<iframe srcdoc="${encodeURIComponent(e.target.result)}" style="width:100%;height:100%;border:none;"></iframe>` }
                })}
              </div>
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
        // PDF文件 - 使用内嵌iframe
        // 检查是否是由文本文件转换的PDF
        const fileInfo = files?.find(f => f.id === currentFileId);
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
      }

      // 清理URL
      setTimeout(() => {
        URL.revokeObjectURL(fileUrl);
      }, 100);

    } catch (error) {
      message.error(error.response?.data?.detail || '文件预览失败');
    }
  };

  // 处理下载码提交
  const handleDownloadCodeSubmit = () => {
    downloadForm.validateFields().then((values) => {
      if (isPreviewMode) {
        // 如果是预览模式，调用预览函数
        handlePreview(currentFileId, true, null, values.downloadCode);
      } else {
      // 如果是下载模式，调用下载函数
        downloadFile(currentFileId, values.downloadCode);
      }
      setDownloadModalVisible(false);
      downloadForm.resetFields();
      setIsPreviewMode(false); // 重置模式
    });
  };

  // 表格列配置
  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (text, record) => (
        <Space>

          <Text>{text}</Text>
          {(record.downloads || 0) == 0 && (
            <Tooltip title={`已下载 ${record.downloads} 次`}>
              <Badge count={record.downloads} overflowCount={999} size="small">
                <CloudDownloadOutlined style={{ fontSize: '16px', color: '#1890ff' }} />
              </Badge>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '上传时间',
      dataIndex: 'upload_time',
      key: 'upload_time',
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: '上传者',
      dataIndex: 'uploader',
      key: 'uploader',
    },
    {
      title: '类型',
      key: 'type',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.is_private ? '私密文件' : '公开文件'}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.file_type}</Text>
        </Space>
      ),
    },
    {
      title: '下载量',
      dataIndex: 'downloads',
      key: 'downloads',
      sorter: (a, b) => (a.downloads || 0) - (b.downloads || 0),
      render: (downloads) => (
        <Tag color={(downloads || 0) > 0 ? ((downloads || 0) > 10 ? 'green' : 'blue') : 'default'} >
          {downloads || 0} 次下载
        </Tag>
      ),
    },
    {
      title: '下载码',
      key: 'downloadCode',
      render: (_, record) => (
        record.download_code ? (
          <Space>
            <KeyOutlined />
            <Text copyable>{record.download_code}</Text>
          </Space>
        ) : null
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 360,
      render: (_, record) => {
        // 定义四个操作位的按钮
        const previewButton = record.can_preview ? (
          <Button
            size="middle"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record.id, record.is_private, record.download_code)}
          >
            预览
          </Button>
        ) : (
          <Button size="middle" icon={<EyeOutlined />} disabled>
            预览
          </Button>
        );

        const downloadButton = (
          <Button
            size="middle"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, record.is_private, record.download_code)}
          >
            下载
          </Button>
        );

        const shareButton = (!record.is_private || record.uploader === user.username) ? (
          <Button
            size="middle"
            icon={<ShareAltOutlined />}
            onClick={() => handleShare(record)}
          >
            分享
          </Button>
        ) : (
          <Button size="middle" icon={<ShareAltOutlined />} disabled>
            分享
          </Button>
        );

        const deleteButton = record.uploader === user.username ? (
          <Button
            size="middle"
            type="primary"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            删除
          </Button>
        ) : (
          <Button size="middle" type="primary" danger icon={<DeleteOutlined />} disabled>
            删除
          </Button>
        );

        // 添加调试按钮，用于打印record的所有信息
        const debugButton = (
          <Button
            size="small"
            type="link"
            onClick={() => {
              // 可选：使用更友好的方式在UI中显示
              Modal.info({
                title: '文件记录详情',
                width: '80%',
                content: (
                  <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                    <pre>{JSON.stringify(record, null, 2)}</pre>
                  </div>
                ),
              });
            }}
          >
            查看详情
          </Button>
        );

        // 使用表格布局确保按钮对齐
        return (
          <div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, auto)',
              gap: '8px',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              {previewButton}
              {downloadButton}
              {shareButton}
              {deleteButton}
            </div>
            <div style={{ textAlign: 'center' }}>
              {debugButton}
            </div>
          </div>
        );
      }
    }
  ];

  // 处理分享
  const handleShare = (file) => {
    // 设置当前分享文件
    setCurrentShareFile(file);
    
    // 生成分享链接
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/preview/${file.id}`;
    setCurrentShareLink(shareUrl);
    
    // 显示分享对话框
    setShareModalVisible(true);
  };

  // 复制分享链接到剪贴板
  const copyShareLink = () => {
    // 创建一个临时的textarea元素
    const textarea = document.createElement('textarea');
    textarea.value = currentShareLink;
    textarea.style.position = 'fixed'; // 防止页面滚动
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.value += `?download_code=${currentShareFile.downloadCode}`;
    try {
      // 选择文本
      textarea.select();
      textarea.setSelectionRange(0, 99999); // 兼容移动设备

      // 尝试使用新API
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(currentShareLink)
          .then(() => {
            message.success('分享链接已复制到剪贴板');
          })
          .catch(() => {
            // 如果新API失败，回退到document.execCommand
            const successful = document.execCommand('copy');
            if (successful) {
              message.success('分享链接已复制到剪贴板');
            } else {
              message.error('复制失败，请手动复制');
            }
          });
      } else {
        // 在不支持新API的环境中使用旧方法
        const successful = document.execCommand('copy');
        if (successful) {
          message.success('分享链接已复制到剪贴板');
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

  return (
    <div>
      <Card title="文件上传" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <Switch
            checked={isPrivate}
            onChange={(checked) => setIsPrivate(checked)}
            style={{ marginRight: 8 }}
          />
          <span style={{ marginRight: 16 }}>设为私密文件</span>
          
          {isPrivate && (
            <Input
              placeholder="设置4位下载码（可选）"
              value={downloadCode}
              onChange={(e) => setDownloadCode(e.target.value)}
              maxLength={4}
              style={{ width: 200, marginRight: 16 }}
            />
          )}
        </div>
        
        <Dragger
          name="file"
          multiple={true}
          showUploadList={true}
          customRequest={handleUpload}
          accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip,.rar"
          style={{ marginTop: 16 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            点击或拖拽文件到此区域上传
          </p>
          <Paragraph type="secondary">
            支持的文件格式：.txt, .pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png, .zip, .rar
          </Paragraph>
        </Dragger>
      </Card>

      <Card
        title="文件列表"
        extra={
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索文件名、上传者或文件类型"
            style={{ width: 300 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        }
      >
        <Table
          columns={columns}
          dataSource={files?.filter(file => {
            if (!searchText) return true;
            const lowerSearchText = searchText.toLowerCase();
            return (
              file.filename.toLowerCase().includes(lowerSearchText) ||
              file.uploader.toLowerCase().includes(lowerSearchText) ||
              file.file_type?.toLowerCase().includes(lowerSearchText) ||
              (file.is_private ? '私密文件' : '公开文件').includes(lowerSearchText)
            );
          })}
          rowKey="id"
          loading={isLoading}
        />
      </Card>

      <Modal
        title="输入下载码"
        open={downloadModalVisible}
        onOk={handleDownloadCodeSubmit}
        okText={isPreviewMode ? "预览文件" : "下载文件"}
        cancelText="取消"
        onCancel={() => {
          setDownloadModalVisible(false);
          downloadForm.resetFields();
          setIsPreviewMode(false); // 重置模式
        }}
      >
        <Form form={downloadForm}>
          <Form.Item
            name="downloadCode"
            rules={[{ required: true, message: '请输入下载码' }]}
          >
            <Input placeholder="请输入4位下载码" maxLength={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分享对话框 */}
      <Modal
        title="分享文件"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={[
          <Button key="copy" type="primary" onClick={copyShareLink} icon={<ShareAltOutlined />}>
            复制链接
          </Button>,
          <Button key="close" onClick={() => setShareModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>文件名：</Text>
          <Text>{currentShareFile?.filename}</Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong>文件类型：</Text>
          <Text type={currentShareFile?.is_private ? "warning" : "success"}>
            {currentShareFile?.is_private ? "私密文件" : "公开文件"}
          </Text>
        </div>
        
        {/* 只有私密文件且是上传者时才显示下载码 */}
        {currentShareFile?.is_private && currentShareFile?.uploader === user.username && (
          <div style={{ marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 4 }}>
            <Space direction="vertical">
              <Text strong>下载码：</Text>
              <Text code copyable type="success">{currentShareFile.download_code}</Text>
              <Text type="secondary">
                请将下载码单独发送给接收者。接收者需要在预览页面输入下载码才能访问文件。
              </Text>
            </Space>
          </div>
        )}
        
        <div style={{ marginBottom: 16 }}>
          <Text strong>
            {currentShareFile?.is_private ? "分享链接（无下载码）" : "分享链接"}
          </Text>
          <Paragraph copyable style={{ marginTop: 8 }}>
            {currentShareLink}
          </Paragraph>
        </div>
        
        <Text type="secondary">
          提示：分享链接可用于预览和下载文件。
          {currentShareFile?.is_private 
            ? '私密文件的接收者需要输入正确的下载码才能访问。' 
            : '公开文件可以直接访问，无需下载码。'}
        </Text>
      </Modal>
    </div>
  );
}

export default HomePage;