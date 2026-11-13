import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { request, apiJson, setSession, clearSession, loadSessionFromStorage, getToken, getUser, isAuthenticated } from '../lib/api';

const AuthContext = createContext<{
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (username: string, email: string, password: string, role?: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  hasRole: (role: string) => boolean;
  hasPermission: (resource: string, action: string) => boolean;
  can: (resource: string, action: string) => boolean;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const token = getToken();
    if (!token) { setPermissions([]); return; }
    try {
      const data: any = await apiJson('/api/v1/auth/permissions');
      setPermissions(data.permissions || []);
    } catch {
      setPermissions([]);
    }
  }, []);

  useEffect(() => {
    loadSessionFromStorage();
    if (getToken()) {
      fetchPermissions();
    }
    setIsLoading(false);
  }, [fetchPermissions]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const data: any = await apiJson('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (data.user && data.accessToken) {
        setSession(data.accessToken, data.user);
        setUser(data.user);
        await fetchPermissions();
        return { ok: true };
      }
      return { ok: false, error: 'Unexpected login response' };
    } catch (err: any) {
      return { ok: false, error: err.data?.error || err.message || 'Login failed' };
    }
  }, [fetchPermissions]);

  const register = useCallback(async (username: string, email: string, password: string, role?: string) => {
    try {
      const data: any = await apiJson('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, role: role || 'viewer' }),
      });
      return { ok: true, error: undefined };
    } catch (err: any) {
      return { ok: false, error: err.data?.error || err.message || 'Registration failed' };
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setPermissions([]);
  }, []);

  const hasRole = useCallback((role: string) => {
    return user?.role === role || user?.role === 'admin';
  }, [user]);

  const hasPermission = useCallback((resource: string, action: string) => {
    return permissions.includes(`${resource}:${action}`);
  }, [permissions]);

  const can = hasPermission;

  const value = {
    user,
    permissions,
    isAuthenticated: isAuthenticated(),
    isLoading,
    login,
    register,
    logout,
    hasRole,
    hasPermission,
    can,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
