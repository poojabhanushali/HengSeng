import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

export type PermissionResource = 'assets' | 'exchanges' | 'social' | 'news' | 'predictions' | 'pipeline' | 'reports' | 'settings' | 'users' | 'roles' | 'permissions';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'run' | 'approve';

export interface PermissionGateProps {
  resource: PermissionResource;
  action: PermissionAction;
  children?: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only if the current user has the given permission.
 * Falls back to `fallback` (or null) when not permitted.
 */
export function PermissionGate({ resource, action, children, fallback }: PermissionGateProps) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission(resource, action);
  if (!allowed) return fallback ?? null;
  return <>{children}</>;
}

export function usePermission(resource: PermissionResource, action: PermissionAction): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(resource, action);
}

export function usePermissions(): string[] {
  const { permissions } = useAuth();
  return permissions;
}

export function can(resource: PermissionResource, action: PermissionAction, permissions: string[]): boolean {
  return permissions.includes(`${resource}:${action}`);
}
