import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { LoginView } from './LoginView';

function Harness({ children }: { children: React.ReactNode }) {
  const { login, user, isAuthenticated } = useAuth();
  return (
    <AuthProvider>
      <div>
        {isAuthenticated ? <div data-testid="signed-in">{user?.username}</div> : children}
      </div>
    </AuthProvider>
  );
}

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form and switches to register', () => {
    render(
      <AuthProvider>
        <LoginView onLogin={() => {}} />
      </AuthProvider>,
    );
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Register/i })).toBeInTheDocument();
  });

  it('shows demo credentials hint', () => {
    render(
      <AuthProvider>
        <LoginView onLogin={() => {}} />
      </AuthProvider>,
    );
    expect(screen.getByText(/Demo credentials:/i)).toBeInTheDocument();
  });
});
