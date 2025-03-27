import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Upload,
  message,
  Card,
  Switch,
  Input,
  Modal,
  Form,
  Space,
  Typography,
} from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  KeyOutlined,
  DeleteOutlined,
  InboxOutlined,
  EyeOutlined,
  SearchOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Text, Paragraph } = Typography;
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
  const handleDownload = (fileId, isPrivateFile, fileDownloadCode) => {
    // 如果是自己的文件或者是公开文件，直接下载
    if (!isPrivateFile || fileDownloadCode) {
      downloadFile(fileId);
      return;
    }

    // 如果是私密文件且不是自己的，显示输入下载码的对话框
    setCurrentFileId(fileId);
    setDownloadModalVisible(true);
    setIsPreviewMode(false); // 标记为下载模式
  };

  // 下载文件
  const downloadFile = async (fileId, code = null) => {
    try {
      const token = localStorage.getItem('token');
      let url = `/api/files/${fileId}`;
      if (code) {
        url += `?download_code=${code}`;
      }

      const response = await axios({
        url,
        method: 'GET',
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });

      // 创建下载链接
      const href = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      
      // 从响应头中获取文件名
      const contentDisposition = response.headers['content-disposition'];
      let filename = '';
      
      // 尝试从Content-Disposition头获取文件名
      if (contentDisposition) {
        // 处理 UTF-8 编码的文件名
        const matches = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/);
        if (matches) {
          filename = decodeURIComponent(matches[1] || matches[2] || matches[3]);
        }
      }
      
      // 如果无法从响应头获取文件名，使用files数据中的文件名
      if (!filename) {
        const fileInfo = files?.find(f => f.id === fileId);
        filename = fileInfo ? fileInfo.filename : 'unknown_file';
      }
      
      link.href = href;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(href);
      
      message.success('文件下载成功');
    } catch (error) {
      message.error(error.response?.data?.detail || '文件下载失败');
    }
  };

  // 处理文件预览
  const handlePreview = async (fileId, isPrivateFile, fileDownloadCode, inputCode = null) => {
    try {
      const token = localStorage.getItem('token');
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

      const response = await axios({
        url,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
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
  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
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
      render: (_, record) => (
        <Space>
          {record.can_preview && (
            <Button
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record.id, record.is_private, record.download_code)}
            >
              预览
            </Button>
          )}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, record.is_private, record.download_code)}
          >
            下载
          </Button>
          {/* 公开文件所有人都可以分享，私密文件只有上传者可以分享 */}
          {(!record.is_private || record.uploader === user.username) && (
            <Button
              icon={<ShareAltOutlined />}
              onClick={() => handleShare(record)}
            >
              分享
            </Button>
          )}
          {/* 只有上传者可以删除文件 */}
          {record.uploader === user.username && (
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            >
              删除
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // 处理文件分享
  const handleShare = (file) => {
    const baseUrl = window.location.origin;
    let shareLink = `${baseUrl}/preview/${file.id}`;
    
    // 如果是公开文件，直接分享链接
    // 如果是私密文件且是上传者，可以查看并分享下载码
    // 如果是私密文件但不是上传者，不应该能分享（UI上已限制）
    
    setCurrentShareFile(file);
    setCurrentShareLink(shareLink);
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
          <Text strong>分享链接：</Text>
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