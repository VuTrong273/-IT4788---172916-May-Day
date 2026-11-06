import {
  InvalidSessionError,
  parseSession,
  SESSION_KEY,
  SessionStorageError,
  type Session,
} from './session.shared';

export type { Session } from './session.shared';

function getWebStorage(
  operation: 'read' | 'write' | 'clear',
): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    throw new SessionStorageError(operation, 'web');
  }
}

export async function saveSession(session: Session): Promise<void> {
  if (!parseSession(JSON.stringify(session))) throw new InvalidSessionError();
  const storage = getWebStorage('write');
  if (!storage) throw new SessionStorageError('write', 'web');
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new SessionStorageError('write', 'web');
  }
}

export async function getSession(): Promise<Session | null> {
  const storage = getWebStorage('read');
  if (!storage) return null;

  let stored: string | null;
  try {
    stored = storage.getItem(SESSION_KEY);
  } catch {
    throw new SessionStorageError('read', 'web');
  }
  const session = parseSession(stored);
  if (stored && !session) {
    try {
      storage.removeItem(SESSION_KEY);
    } catch {
      throw new SessionStorageError('clear', 'web');
    }
  }
  return session;
}

export async function clearSession(): Promise<void> {
  const storage = getWebStorage('clear');
  if (!storage) return;
  try {
    storage.removeItem(SESSION_KEY);
  } catch {
    throw new SessionStorageError('clear', 'web');
  }
}
