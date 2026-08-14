import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('arc_token'));
  const [loading, setLoading] = useState(true);

  // Fetch user info when token exists
  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Auth error:', error);
      // Token invalid, clear it
      localStorage.removeItem('arc_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    
    localStorage.setItem('arc_token', newToken);
    setToken(newToken);
    setUser(userData);
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('arc_token');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isPlatformOwner = user?.role === 'platform_owner';
  const isOperatorAdmin = user?.role === 'operator_admin' || isPlatformOwner;
  const isClientAdmin = user?.role === 'client_admin' || isOperatorAdmin;
  const isDriver = user?.role === 'driver';

  // Create axios instance with auth header
  const authAxios = axios.create({
    baseURL: API,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated,
    isPlatformOwner,
    isOperatorAdmin,
    isClientAdmin,
    isDriver,
    authAxios,
    refreshUser: fetchUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
