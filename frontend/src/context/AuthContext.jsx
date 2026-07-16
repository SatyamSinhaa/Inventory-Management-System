// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('ims_user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('ims_token') || null);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token: tok, username: uname, role } = res.data;
    localStorage.setItem('ims_token', tok);
    localStorage.setItem('ims_user', JSON.stringify({ username: uname, role }));
    setToken(tok);
    setUser({ username: uname, role });
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ims_token');
    localStorage.removeItem('ims_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
