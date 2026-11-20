import type { Session } from "./session.shared";
const listeners = new Set<(session: Session) => void>();
const snapshots = new Map<string, Session["access"]>();
export function knownAccess(token: string) {
  return snapshots.get(token);
}
const invalidations = new Set<(token: string) => void>();
export function subscribeAccess(listener: (session: Session) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function publishAccess(session: Session) {
  snapshots.clear();
  snapshots.set(
    session.token,
    session.access ?? {
      user_id: session.user.user_id,
      role_id: session.user.role_id,
      base_role: session.user.base_role ?? null,
      endpoints: [],
      routes: [],
    },
  );
  for (const listener of listeners) listener(session);
}
export function subscribeAccessInvalidation(listener: (token: string) => void) {
  invalidations.add(listener);
  return () => {
    invalidations.delete(listener);
  };
}
export function invalidateAccess(token: string) {
  for (const listener of invalidations) listener(token);
}
