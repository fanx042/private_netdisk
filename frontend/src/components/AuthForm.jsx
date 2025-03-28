import React from 'react';
import { Form, Input, Button, Card } from 'antd';
import { Link } from 'react-router-dom';

// 通用的认证表单组件，可用于登录和注册
function AuthForm({
  title,
  onFinish,
  isRegister = false,
  loading = false
}) {
  return (
    <div style={{ maxWidth: 400, margin: '0 auto', marginTop: 50 }}>
      <Card title={title} bordered={false}>
        <Form
          name={isRegister ? 'register' : 'login'}
          onFinish={onFinish}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              ...(isRegister ? [{ min: 3, message: '用户名至少3个字符' }] : [])
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              ...(isRegister ? [{ min: 6, message: '密码至少6个字符' }] : [])
            ]}
          >
            <Input.Password />
          </Form.Item>

          {isRegister && (
            <Form.Item
              label="确认密码"
              name="confirmPassword"
              rules={[
                { required: true, message: '请确认密码' },
                { min: 6, message: '密码至少6个字符' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              style={{ width: '100%' }}
              loading={loading}
            >
              {isRegister ? '注册' : '登录'}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            {isRegister ? (
              <>已有账号？ <Link to="/login">立即登录</Link></>
            ) : (
              <>还没有账号？ <Link to="/register">立即注册</Link></>
            )}
          </div>
        </Form>
      </Card>
    </div>
  );
}

export default AuthForm;