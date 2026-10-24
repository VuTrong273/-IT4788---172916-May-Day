import * as SecureStore from 'expo-secure-store';

import { parseSession, SESSION_KEY, type Session } from './session.shared';

export type { Session } from './session.shared';

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<Session | null> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  const session = parseSession(stored);
  if (stored && !session) {
    await clearSession();
  }
  return session;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
