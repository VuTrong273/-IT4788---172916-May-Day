import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { authApi } from "./auth-api";
import { roleFromId, type Session } from "./auth-types";
import { apiRequest, type ApiEnvelope } from "@/lib/api/client";
import { hasEndpoint, type AccessSnapshot } from "./permissions";

const SESSION_KEY = "mayday.web.session";

function readSavedSession(): Session | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const session = JSON.parse(stored) as Session;
    return session.token && session.user?.user_id && roleFromId(session.user)
      ? session
      : null;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  session: Session | null;
  signIn: (phone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserName: (fullName: string) => void;
  can: (method: string, path: string) => boolean;
  accessReady: boolean;
  accessError: string;
  refreshAccess: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState(readSavedSession);
  const [access, setAccess] = useState<AccessSnapshot | null>(null);
  const [accessError, setAccessError] = useState("");
  const token = session?.token;
  async function refreshAccess() {
    if (!token) {
      setAccess(null);
      return;
    }
    try {
      const response = await apiRequest<ApiEnvelope<AccessSnapshot>>(
        "/auth/access",
        { token },
      );
      setAccess((previous) =>
        JSON.stringify(previous) === JSON.stringify(response.data)
          ? previous
          : response.data,
      );
      setAccessError("");
      setSession((current) =>
        current &&
        current.token === token &&
        (current.user.role_id !== response.data.role_id ||
          current.user.base_role !== response.data.base_role)
          ? {
              ...current,
              user: {
                ...current.user,
                role_id: response.data.role_id,
                base_role: response.data.base_role,
              },
            }
          : current,
      );
    } catch (reason) {
      setAccess(null);
      setAccessError(
        reason instanceof Error
          ? reason.message
          : "Không tải được quyền truy cập.",
      );
    }
  }
  useEffect(() => {
    let active = true;
    setAccess(null);
    async function refresh() {
      try {
        const result = await apiRequest<ApiEnvelope<AccessSnapshot>>(
          "/auth/access",
          { token },
        );
        if (active) {
          setAccess((previous) =>
            JSON.stringify(previous) === JSON.stringify(result.data)
              ? previous
              : result.data,
          );
          setAccessError("");
          setSession((current) =>
            current &&
            current.token === token &&
            (current.user.role_id !== result.data.role_id ||
              current.user.base_role !== result.data.base_role)
              ? {
                  ...current,
                  user: {
                    ...current.user,
                    role_id: result.data.role_id,
                    base_role: result.data.base_role,
                  },
                }
              : current,
          );
        }
      } catch (reason) {
        if (active) {
          setAccess(null);
          setAccessError(
            reason instanceof Error
              ? reason.message
              : "Không tải được quyền truy cập.",
          );
        }
      }
    }
    if (!token) return;
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("mayday:permissions-changed", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("mayday:permissions-changed", refresh);
    };
  }, [token]);
  useEffect(() => {
    function expire() {
      sessionStorage.removeItem(SESSION_KEY);
      setSession(null);
    }
    window.addEventListener("mayday:session-expired", expire);
    return () => window.removeEventListener("mayday:session-expired", expire);
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      can: (method, path) =>
        hasEndpoint(access?.endpoints, method, path, access?.routes),
      accessReady: !!access && access.user_id === session?.user.user_id,
      accessError,
      refreshAccess,
      async signIn(phone, password) {
        const next = await authApi.login(phone, password);
        if (!roleFromId(next.user)) {
          throw new Error(
            "Tài khoản bệnh nhân sử dụng ứng dụng May Day Mobile. Web dành cho nhân viên y tế và quản trị viên.",
          );
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
          const updated = {
            ...current,
            user: { ...current.user, full_name: fullName },
          };
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
          return updated;
        });
      },
    }),
    [session, access, accessError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
