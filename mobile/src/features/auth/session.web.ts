import { parseSession, SESSION_KEY, type Session } from './session.shared';

export type { Session } from './session.shared';

function getWebStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage;
}

export async function saveSession(session: Session): Promise<void> {
  const storage = getWebStorage();
  if (!storage) throw new Error('Không thể lưu phiên đăng nhập trên trình duyệt.');
  storage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<Session | null> {
  const storage = getWebStorage();
  if (!storage) return null;

  const stored = storage.getItem(SESSION_KEY);
  const session = parseSession(stored);
  if (stored && !session) storage.removeItem(SESSION_KEY);
  return session;
}

export async function clearSession(): Promise<void> {
  getWebStorage()?.removeItem(SESSION_KEY);
}
