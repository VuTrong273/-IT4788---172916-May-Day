import { createContext, useContext, type ReactNode } from 'react';
import type { Session } from '@/features/auth/session';
import { canAccess } from '@/features/auth/permissions';

const AccessContext = createContext<Session | null>(null);
export function PermissionGate({ permission, children }: { permission: readonly [method: string, path: string]; children: ReactNode }) {
  const session = useContext(AccessContext);
  return canAccess(session, ...permission) ? children : null;
}
export function PermissionsProvider({ session, children }: { session: Session; children: ReactNode }) {
  return <AccessContext.Provider value={session}>{children}</AccessContext.Provider>;
}
