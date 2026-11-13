import { User, UserRole } from '../types';

const API_BASE = '';

let accessToken: string | null = null;
let currentUser: User | null = null;

export function setSession(token: string, user: User) {
  accessToken = token;
  currentUser = user;
  try { localStorage.setItem('hs_token', token); } catch { /* noop */ }
  try { localStorage.setItem('hs_user', JSON.stringify(user)); } catch { /* noop */ }
}

export function clearSession() {
  accessToken = null;
  currentUser = null;
  try { localStorage.removeItem('hs_token'); } catch { /* noop */ }
  try { localStorage.removeItem('hs_user'); } catch { /* noop */ }
}

export function loadSessionFromStorage() {
  try {
    const t = localStorage.getItem('hs_token');
    const u = localStorage.getItem('hs_user');
    if (t) accessToken = t;
    if (u) currentUser = JSON.parse(u) as User;
  } catch { /* ignore */ }
}

export function getToken(): string | null { return accessToken; }
export function getUser(): User | null { return currentUser; }
export function isAuthenticated(): boolean { return !!accessToken && !!currentUser; }
export function hasRole(role: UserRole): boolean { return currentUser?.role === role; }
export function isAdmin(): boolean { return currentUser?.role === 'admin'; }

async function request(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) || {} };
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (!(init.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${input}`, { ...init, headers });
  if (res.status === 401) {
    // Session expired - clear and let the app redirect to login
    clearSession();
  }
  return res;
}

export { request };

export async function apiJson<T = any>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const res = await request(input, init);
  const text = await res.text();
  let data: any = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!res.ok) {
    const err: any = new Error(data?.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}
