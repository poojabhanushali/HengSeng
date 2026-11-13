import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setSession,
  clearSession,
  loadSessionFromStorage,
  getToken,
  getUser,
  isAuthenticated,
  hasRole,
  isAdmin,
} from '../lib/api';

const user = { id: 'u1', username: 'admin', email: 'admin@test.local', role: 'admin', isActive: true, createdAt: '2026-01-01' };

beforeEach(() => {
  clearSession();
  localStorage.clear();
  vi.resetModules();
});

describe('auth session helpers', () => {
  it('setSession/getToken/getUser/isAuthenticated/hasRole/isAdmin', () => {
    setSession('tok123', user as any);
    expect(getToken()).toBe('tok123');
    expect(getUser()?.username).toBe('admin');
    expect(isAuthenticated()).toBe(true);
    expect(hasRole('admin')).toBe(true);
    expect(hasRole('viewer')).toBe(false);
    expect(isAdmin()).toBe(true);
  });

  it('clearSession removes everything', () => {
    setSession('tok123', user as any);
    clearSession();
    expect(getToken()).toBeNull();
    expect(getUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('loadSessionFromStorage restores from localStorage', () => {
    localStorage.setItem('hs_token', 'stored-token');
    localStorage.setItem('hs_user', JSON.stringify(user));
    loadSessionFromStorage();
    expect(getToken()).toBe('stored-token');
    expect(getUser()?.username).toBe('admin');
  });
});
