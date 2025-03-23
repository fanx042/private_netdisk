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
  const [downloadForm] = Form.useForm();
  const queryClient = useQueryClient();

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

  // 处理下载码提交
  const handleDownloadCodeSubmit = () => {
    downloadForm.validateFields().then((values) => {
      downloadFile(currentFileId, values.downloadCode);
      setDownloadModalVisible(false);
      downloadForm.resetFields();
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
        <Text>{record.is_private ? '私密文件' : '公开文件'}</Text>
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
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record.id, record.is_private, record.download_code)}
          >
            下载
          </Button>
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

      <Card title="文件列表">
        <Table
          columns={columns}
          dataSource={files}
          rowKey="id"
          loading={isLoading}
        />
      </Card>

      <Modal
        title="输入下载码"
        open={downloadModalVisible}
        onOk={handleDownloadCodeSubmit}
        onCancel={() => {
          setDownloadModalVisible(false);
          downloadForm.resetFields();
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
    </div>
  );
}

export default HomePage;