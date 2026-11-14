import * as SecureStore from 'expo-secure-store';

import {
  InvalidSessionError,
  parseSession,
  SESSION_KEY,
  SessionStorageError,
  type Session,
} from './session.shared';

export type { Session } from './session.shared';

export async function saveSession(session: Session): Promise<void> {
  if (!parseSession(JSON.stringify(session))) throw new InvalidSessionError();
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch {
    throw new SessionStorageError('write', 'native');
  }
}

export async function getSession(): Promise<Session | null> {
  let stored: string | null;
  try {
    stored = await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    throw new SessionStorageError('read', 'native');
  }
  const session = parseSession(stored);
  if (stored && !session) {
    await clearSession();
  }
  return session;
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    throw new SessionStorageError('clear', 'native');
  }
}
