import React, { useState } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthForm from '../components/AuthForm';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/');
    } catch (error) {
      const errorMessage = error.response?.data?.detail;
      if (errorMessage === 'Account is already logged in on another device') {
        message.error('该账号已在其他设备登录，请先注销');
      } else {
        message.error(errorMessage || '登录失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="登录"
      onFinish={onFinish} 
      loading={loading}
    />
  );
}

export default LoginPage;