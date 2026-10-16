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
  return stored ? (JSON.parse(stored) as Session) : null;
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
