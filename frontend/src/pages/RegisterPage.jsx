import React, { useState } from 'react';
import { message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthForm from '../components/AuthForm';

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await register(values.username, values.password);
      message.success('注册成功');
      navigate('/');
    } catch (error) {
      message.error(error.response?.data?.detail || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="注册"
      onFinish={onFinish} 
      isRegister={true}
      loading={loading}
    />
  );
}

export default RegisterPage;