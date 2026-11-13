import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { ClipboardList, ShieldCheck, Users } from 'lucide-react';

type RolePerm = {
  id: string;
  resource: string;
  action: string;
  label: string;
  description: string;
  granted: boolean;
};

type RoleWithPerms = { id: string; name: string; permissions: RolePerm[] };
type UserRow = { id: string; username: string; role: string; permissions: string[] };

const RESOURCE_ORDER: string[] = [
  'assets', 'exchanges', 'social', 'news', 'predictions', 'pipeline',
  'reports', 'settings', 'users', 'roles', 'permissions',
];

const ACTION_ORDER: string[] = ['view', 'create', 'edit', 'delete', 'run', 'approve'];

const ALL_PERMISSIONS: string[] = [
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

const resourceLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

export function RolesAndPermissionsView() {
  const { hasRole, hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleWithPerms[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<{ role?: string; user?: string }>({});

  const isAdmin = hasRole('admin');
  const canManageRoles = hasPermission('roles', 'edit');
  const canManageUsers = hasPermission('users', 'edit');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesRes, usersRes] = await Promise.all([
        apiJson<{ roles: { id: string; name: string }[] }>('/api/v1/auth/roles'),
        apiJson<{ users: { id: string; username: string; role: string }[] }>('/api/v1/auth/users'),
      ]);
      const roleDetails = await Promise.all(rolesRes.roles.map(async (r) => {
        const perms: any = await apiJson(`/api/v1/auth/roles/${r.id}/permissions`);
        return { id: r.id, name: r.name, permissions: perms.permissions };
      }));
      setRoles(roleDetails);
      const userRows = await Promise.all(usersRes.users.map(async (u) => {
        const perms: any = await apiJson(`/api/v1/auth/users/${u.id}/permissions`);
        return { id: u.id, username: u.username, role: u.role, permissions: perms.permissions };
      }));
      setUsers(userRows);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Failed to load roles and permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2 animate-pulse">
          <ClipboardList className="w-10 h-10 text-slate-400" />
          <p className="text-slate-500 text-sm">Loading roles &amp; permissions…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-4 text-red-300">{error}</div>
      </div>
    );
  }

  if (!canManageRoles && !canManageUsers) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-4 text-red-300">
          You do not have permission to manage roles or permissions.
        </div>
      </div>
    );
  }

  const groupedPerms = (perms: RolePerm[]) => {
    const map = new Map<string, RolePerm[]>();
    for (const p of perms) {
      if (!map.has(p.resource)) map.set(p.resource, []);
      map.get(p.resource)!.push(p);
    }
    return RESOURCE_ORDER.filter(r => map.has(r)).map(resource => ({
      resource,
      items: map.get(resource)!.sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action)),
    }));
  };

  const handleRolePermChange = (roleId: string, permId: string, granted: boolean) => {
    const role = roles.find(r => r.id === roleId)!;
    const perm = role.permissions.find(p => p.id === permId)!;
    perm.granted = granted;
    setRoles(roles.map(r => r.id === roleId ? { ...r, permissions: [...r.permissions] } : r));
  };

  const handleUserPermChange = (userId: string, permId: string, granted: boolean) => {
    const u = users.find(u => u.id === userId)!;
    const idx = u.permissions.indexOf(permId);
    if (granted && idx === -1) u.permissions.push(permId);
    else if (!granted && idx !== -1) u.permissions.splice(idx, 1);
    setUsers(users.map(u => u.id === userId ? { ...u, permissions: [...u.permissions] } : u));
  };

  const saveRole = async (roleId: string) => {
    const role = roles.find(r => r.id === roleId)!;
    setSaving({ role: roleId });
    try {
      await apiJson(`/api/v1/auth/roles/${roleId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: role.permissions.map(p => ({ id: p.id, granted: p.granted })) }),
      });
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Failed to save role permissions');
    } finally {
      setSaving({});
    }
  };

  const saveUser = async (userId: string) => {
    const u = users.find(u => u.id === userId)!;
    setSaving({ user: userId });
    try {
      await apiJson(`/api/v1/auth/users/${userId}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: ALL_PERMISSIONS.map(p => ({ id: p, granted: u.permissions.includes(p) })) }),
      });
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Failed to save user permissions');
    } finally {
      setSaving({});
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Roles &amp; Permissions</h2>
        </div>
        <p className="text-xs text-slate-500">Granular, database-driven access control</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => { /* roles active */ }}
          className="px-4 py-1.5 text-sm font-medium border-b-2 border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20"
        >
          Roles
        </button>
        <button
          onClick={() => { /* users active */ }}
          className="px-4 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          Users
        </button>
      </div>

      {/* Roles Tab */}
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 w-40">Role</th>
                {RESOURCE_ORDER.map(r => (
                  <th key={r} className="px-2 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase" title={resourceLabel(r)}>
                    {resourceLabel(r)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {roles.map(role => {
                const allPerms = role.permissions;
                return (
                  <tr key={role.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{role.name}</td>
                    {RESOURCE_ORDER.map(resource => (
                      <td key={resource} className="px-2 py-2 text-center space-y-0.5">
                        {ACTION_ORDER.map(action => {
                          const p = allPerms.find(x => x.resource === resource && x.action === action);
                          if (!p) return null;
                          return (
                            <input
                              key={p.id}
                              type="checkbox"
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              checked={p.granted}
                              onChange={(e) => handleRolePermChange(role.id, p.id, e.target.checked)}
                              disabled={!canManageRoles || saving.role === role.id}
                            />
                          );
                        })}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => saveRole(role.id)}
                        disabled={!canManageRoles || saving.role === role.id}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-transparent bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
                      >
                        {saving.role === role.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Unchecked = denied. Changes are saved per-role. System roles cannot be deleted, but permissions are fully configurable.
        </p>
      </div>

      {/* Users Tab */}
      <div className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 w-48">User</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 w-20">Role</th>
                {ALL_PERMISSIONS.map(p => (
                  <th key={p} className="px-1 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase" title={p}>
                    {p.split(':')[1].charAt(0).toUpperCase()}
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {users.map(u => {
                const has = (p: string) => u.permissions.includes(p);
                return (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{u.username}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        u.role === 'admin' ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400' :
                        u.role === 'manager' ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                        'border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    {ALL_PERMISSIONS.map(p => (
                      <td key={p} className="px-1 py-2 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                          checked={has(p)}
                          onChange={(e) => handleUserPermChange(u.id, p, e.target.checked)}
                          disabled={!canManageUsers || saving.user === u.id}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => saveUser(u.id)}
                        disabled={!canManageUsers || saving.user === u.id}
                        className="px-3 py-1.5 text-xs font-medium rounded border border-transparent bg-emerald-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition-colors"
                      >
                        {saving.user === u.id ? 'Saving…' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          User overrides add to or remove from the role&rsquo;s base permissions. Changes saved per-user.
        </p>
      </div>
    </div>
  );
}
