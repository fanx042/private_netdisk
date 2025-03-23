import React from 'react';
import { Layout, Menu, Button, Dropdown } from 'antd';
import { useNavigate } from 'react-router-dom';
import { UserOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Header } = Layout;

function AppHeader() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const userMenu = (
    <Menu
      items={[
        {
          key: '1',
          label: '修改密码',
          onClick: () => navigate('/profile'),
        },
        {
          key: '2',
          label: '退出登录',
          onClick: logout,
        },
      ]}
    />
  );

  return (
    <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ color: 'white', fontSize: '20px' }}>私人网盘</div>
      {isAuthenticated ? (
        <Dropdown overlay={userMenu} placement="bottomRight">
          <Button type="text" icon={<UserOutlined />} style={{ color: 'white' }}>
            {user?.username}
          </Button>
        </Dropdown>
      ) : (
        <div>
          <Button type="link" onClick={() => navigate('/login')} style={{ color: 'white' }}>
            登录
          </Button>
          <Button type="link" onClick={() => navigate('/register')} style={{ color: 'white' }}>
            注册
          </Button>
        </div>
      )}
    </Header>
  );
}

export default AppHeader;