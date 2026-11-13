import { Request, Response, NextFunction } from 'express';
import { Database } from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { UserRole } from '../src/types';
import { appDb } from './db/sqlite';

export type Permission = `${string}:${string}`;

export const ALL_PERMISSIONS: Permission[] = [
  'assets:view', 'assets:create', 'assets:edit', 'assets:delete',
  'exchanges:view',
  'social:view',
  'news:view',
  'predictions:view', 'predictions:run',
  'pipeline:view', 'pipeline:run',
  'reports:view', 'reports:create', 'reports:approve',
  'settings:view', 'settings:edit',
  'users:view', 'users:create', 'users:edit', 'users:delete',
  'roles:view', 'roles:edit',
  'permissions:view',
];

export const RESOURCE_LABELS: Record<string, string> = {
  assets: 'Assets', exchanges: 'Exchanges', social: 'Social Sentiment', news: 'News Intelligence',
  predictions: 'Price Predictions', pipeline: 'Pipeline', reports: 'Executive Reports',
  settings: 'Settings', users: 'Users', roles: 'Roles', permissions: 'Permissions',
};

export const ACTION_LABELS: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', run: 'Run', approve: 'Approve',
};

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY || 'hengseng-dev-secret-change-in-production';

export function authenticateUser(req: Request, res: Response, next: NextFunction): boolean {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required', detail: 'Missing or invalid Authorization header' });
    return true;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'hengseng' }) as { sub: string; role: string };
    const row = appDb.db.prepare('SELECT id,username,email,role,is_active,created_at FROM users WHERE id = ?').get(payload.sub) as any;
    if (!row || !row.is_active) {
      res.status(401).json({ error: 'Authentication required', detail: 'User not found or inactive' });
      return true;
    }
    (req as any).user = {
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role as UserRole,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
    };
    next();
    return false;
  } catch {
    res.status(401).json({ error: 'Authentication required', detail: 'Token expired or invalid' });
    return true;
  }
}

export function hasPermission(permissions: string[], resource: string, action: string): boolean {
  return permissions.includes(`${resource}:${action}`);
}

export function hasAnyPermission(permissions: string[], checks: { resource: string; action: string }[]): boolean {
  return checks.some(c => hasPermission(permissions, c.resource, c.action));
}

export function getEffectivePermissions(db: Database, userId: string): string[] {
  const user = db.prepare('SELECT id,username,role,is_active FROM users WHERE id = ?').get(userId) as any;
  if (!user || !user.is_active) return [];

  const role = user.role as UserRole;

  const roleRows = db.prepare(`
    SELECT p.resource, p.action
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    JOIN roles r ON r.id = rp.role_id
    WHERE rp.role_id = (SELECT id FROM roles WHERE name = ? LIMIT 1) AND rp.granted = 1
  `).all(role) as { resource: string; action: string }[];

  const perms = new Set<string>();
  for (const r of roleRows) perms.add(`${r.resource}:${r.action}`);

  const userRows = db.prepare(`
    SELECT p.resource, p.action, up.granted
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = ?
  `).all(userId) as { resource: string; action: string; granted: number }[];

  for (const r of userRows) {
    const key = `${r.resource}:${r.action}`;
    if (r.granted === 1) perms.add(key);
    else perms.delete(key);
  }

  return Array.from(perms);
}

export function requirePermission(resource: string, action: string) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const handled = authenticateUser(_req, res, () => {});
    if (handled) return;
    const user = (_req as any).user as AuthUser;
    const perms = getEffectivePermissions(appDb.db, user.id);
    if (!hasPermission(perms, resource, action)) {
      res.status(403).json({
        error: 'Forbidden',
        detail: `Insufficient permission: ${resource}:${action}`,
        required: `${resource}:${action}`,
      });
      return;
    }
    next();
  };
}

export function requireAnyPermission(checks: { resource: string; action: string }[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const handled = authenticateUser(_req, res, () => {});
    if (handled) return;
    const user = (_req as any).user as AuthUser;
    const perms = getEffectivePermissions(appDb.db, user.id);
    if (!hasAnyPermission(perms, checks)) {
      res.status(403).json({
        error: 'Forbidden',
        detail: `Insufficient permission. Required one of: ${checks.map(c => `${c.resource}:${c.action}`).join(', ')}`,
      });
      return;
    }
    next();
  };
}

export function requireRole(roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const handled = authenticateUser(_req, res, () => {});
    if (handled) return;
    const user = (_req as any).user as AuthUser;
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden', detail: `Required role: ${roles.join(', ')}` });
      return;
    }
    next();
  };
}
