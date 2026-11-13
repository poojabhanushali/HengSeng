import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function LoginView({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'viewer'>('viewer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        const res = await login(username, password);
        if (res.ok) onLogin();
        else setError(res.error || 'Login failed');
      } else {
        const res = await register(username, email, password, role);
        if (res.ok) {
          setError('Account created. Please log in.');
          setMode('login');
        } else setError(res.error || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f17] p-4">
      <div className="w-full max-w-md bg-[#111827] p-8 rounded-xl shadow-xl border border-slate-700">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-emerald-400">HengSeng</h1>
          <p className="text-slate-400 text-sm">Sentiment Intelligence Platform</p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded bg-red-900/30 border border-red-500/30 text-red-300 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Username</label>
            <input
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              placeholder="Username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Email</label>
                <input
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  placeholder="email@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Role</label>
                <select
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-white font-semibold transition-colors"
            disabled={loading}
          >
            {loading ? 'Processing...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          {mode === 'login'
            ? "Don't have an account? "
            : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-emerald-400 hover:underline font-medium ml-1"
          >
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Demo credentials: admin / admin123 (admin), manager / admin123, viewer / admin123
        </p>
      </div>
    </div>
  );
}
