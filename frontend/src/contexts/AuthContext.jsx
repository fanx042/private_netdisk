import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/user/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Error fetching user info:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post('/api/login', formData);
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    await fetchUserInfo();
  };

  const register = async (username, password) => {
    const response = await axios.post('/api/register', {
      username,
      password,
    });
    const { access_token } = response.data;
    localStorage.setItem('token', access_token);
    await fetchUserInfo();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updatePassword = async (newPassword) => {
    const token = localStorage.getItem('token');
    await axios.put('/api/user/me', 
      { new_password: newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    register,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}