import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { authApi } from './auth-api';
import { roleFromId, type Session } from './auth-types';

const SESSION_KEY = 'mayday.web.session';

function readSavedSession(): Session | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as Session;
    return session.token && session.user?.user_id && roleFromId(session.user.role_id) ? session : null;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  session: Session | null;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserName: (fullName: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState(readSavedSession);
  const value = useMemo<AuthContextValue>(() => ({
    session,
    async signIn(phone, password) {
      const next = await authApi.login(phone, password);
      if (!roleFromId(next.user.role_id)) {
        throw new Error('Tài khoản bệnh nhân sử dụng ứng dụng May Day Mobile. Web dành cho nhân viên y tế và quản trị viên.');
      }
      setSession(next);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    },
    async signOut() {
      const current = session;
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
      if (current) await authApi.logout(current.token);
    },
    updateUserName(fullName) {
      setSession((current) => {
        if (!current) return null;
        const updated = { ...current, user: { ...current.user, full_name: fullName } };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
        return updated;
      });
    },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
