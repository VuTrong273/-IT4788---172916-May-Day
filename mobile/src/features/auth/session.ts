import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'mayday.session';

export type Session = {
  token: string;
  user: {
    user_id: number;
    full_name: string;
    phone: string;
    role_id: number;
  };
};

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<Session | null> {
  const stored = await SecureStore.getItemAsync(SESSION_KEY);
  if (!stored) return null;

  const session = JSON.parse(stored) as Session;
  if (session.token === 'demo-token') {
    await clearSession();
    return null;
  }
  return session;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
