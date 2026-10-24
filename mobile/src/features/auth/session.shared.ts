export const SESSION_KEY = 'mayday.session';

export type Session = {
  token: string;
  user: {
    user_id: number;
    full_name: string;
    phone: string;
    role_id: number;
  };
};

export function parseSession(stored: string | null): Session | null {
  if (!stored) return null;

  try {
    const session = JSON.parse(stored) as Session;
    if (!session?.token || session.token === 'demo-token' || !session.user?.user_id) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}
