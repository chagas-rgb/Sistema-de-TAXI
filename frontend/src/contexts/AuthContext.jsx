import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

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
  // Initialize user from sessionStorage if available (for tab persistence)
  const [user, setUser] = useState(() => {
    try {
      const cached = sessionStorage.getItem('arc_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('arc_token'));
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const tokenValidatedRef = useRef(false);

  // Persist user to sessionStorage for navigation persistence
  useEffect(() => {
    if (user) {
      sessionStorage.setItem('arc_user', JSON.stringify(user));
    } else {
      sessionStorage.removeItem('arc_user');
    }
  }, [user]);

  // Fetch user info when token exists - validates token on initial load
  const fetchUser = useCallback(async (showExpiredMessage = false) => {
    if (!token) {
      setLoading(false);
      setUser(null);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      setSessionExpired(false);
      tokenValidatedRef.current = true;
    } catch (error) {
      console.error('Auth error:', error);
      // Token invalid or expired
      localStorage.removeItem('arc_token');
      sessionStorage.removeItem('arc_user');
      setToken(null);
      setUser(null);
      
      // Only show expired message if we had a previous session
      if (showExpiredMessage || tokenValidatedRef.current) {
        setSessionExpired(true);
        toast.error('Sessão expirada. Por favor, faça login novamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Validate token on mount and when token changes
  useEffect(() => {
    // If we have cached user and token, quickly validate
    if (token && user) {
      setLoading(false);
      // Validate token in background
      fetchUser(true);
    } else {
      fetchUser();
    }
  }, []);  // Only run on mount

  // Listen for storage events (other tabs logging out)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'arc_token') {
        if (!e.newValue) {
          // Token removed in another tab
          setUser(null);
          setToken(null);
          sessionStorage.removeItem('arc_user');
        } else if (e.newValue !== token) {
          // Token changed in another tab
          setToken(e.newValue);
          fetchUser();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [token, fetchUser]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    
    localStorage.setItem('arc_token', newToken);
    sessionStorage.setItem('arc_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    setSessionExpired(false);
    tokenValidatedRef.current = true;
    
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('arc_token');
    sessionStorage.removeItem('arc_user');
    setToken(null);
    setUser(null);
    tokenValidatedRef.current = false;
  };

  const isAuthenticated = !!user && !!token;
  const isPlatformOwner = user?.role === 'platform_owner';
  const isOperatorAdmin = user?.role === 'operator_admin' || isPlatformOwner;
  const isClientAdmin = user?.role === 'client_admin' || isOperatorAdmin;
  const isDriver = user?.role === 'driver';

  // Create axios instance with auth header - memoized to prevent unnecessary re-renders
  const authAxios = useMemo(() => {
    const instance = axios.create({
      baseURL: API,
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    
    // Add response interceptor for token expiration
    instance.interceptors.response.use(
      response => response,
      error => {
        if (error.response?.status === 401) {
          // Token expired during API call
          localStorage.removeItem('arc_token');
          sessionStorage.removeItem('arc_user');
          setToken(null);
          setUser(null);
          setSessionExpired(true);
          toast.error('Sessão expirada. Por favor, faça login novamente.');
        }
        return Promise.reject(error);
      }
    );
    
    return instance;
  }, [token]);

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
    refreshUser: fetchUser,
    sessionExpired
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
