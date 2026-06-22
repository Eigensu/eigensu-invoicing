import type { Session } from './session'

export type Permission =
  | 'clients:write'
  | 'projects:write'
  | 'invoices:write'
  | 'payments:write'
  | 'settings:write'
  | 'users:write'
  | 'bank-accounts:write'
  | 'reminder-rules:write'

const PERMISSIONS: Record<Permission, ('admin' | 'viewer' | 'accountant')[]> = {
  'clients:write':        ['admin', 'accountant'],
  'projects:write':       ['admin', 'accountant'],
  'invoices:write':       ['admin', 'accountant'],
  'payments:write':       ['admin', 'accountant'],
  'settings:write':       ['admin'],
  'users:write':          ['admin'],
  'bank-accounts:write':  ['admin'],
  'reminder-rules:write': ['admin'],
}

export function hasPermission(session: Session, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission]
  return allowed.includes(session.user.role as 'admin' | 'viewer' | 'accountant')
}

export function requireRole(session: Session, permission: Permission): void {
  if (!hasPermission(session, permission)) {
    throw new Error('Forbidden')
  }
}

export function isAdmin(session: Session): boolean {
  return session.user.role === 'admin'
}
