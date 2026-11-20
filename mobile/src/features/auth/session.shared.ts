import { getAuthenticatedRole } from "./roles";
import type { AccessSnapshot } from './permissions';

export const SESSION_KEY = "mayday.session";

export type Session = {
  access?: AccessSnapshot;
  accessError?: string;
  token: string;
  user: {
    user_id: number;
    full_name: string;
    phone: string;
    role_id: number;
    base_role?: "admin" | "doctor" | "patient" | null;
  };
};

export class InvalidSessionError extends Error {
  constructor() {
    super("Thông tin phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.");
    this.name = "InvalidSessionError";
  }
}

export class SessionStorageError extends Error {
  constructor(
    operation: "read" | "write" | "clear",
    platform: "web" | "native",
  ) {
    super(
      platform === "web"
        ? "Không thể truy cập vùng lưu phiên đăng nhập của trình duyệt."
        : "Không thể truy cập vùng lưu phiên bảo mật trên thiết bị.",
    );
    this.name = "SessionStorageError";
    this.operation = operation;
    this.platform = platform;
  }

  readonly operation: "read" | "write" | "clear";
  readonly platform: "web" | "native";
}

export function isValidSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<Session>;
  const user = session.user;
  return Boolean(
    typeof session.token === "string" &&
    session.token.trim() &&
    session.token !== "demo-token" &&
    user &&
    Number.isInteger(user.user_id) &&
    user.user_id > 0 &&
    typeof user.full_name === "string" &&
    typeof user.phone === "string" &&
    Number.isInteger(user.role_id) &&
    user.role_id > 0 &&
    getAuthenticatedRole(user),
  );
}

export function parseSession(stored: string | null): Session | null {
  if (!stored) return null;

  try {
    const session: unknown = JSON.parse(stored);
    return isValidSession(session) ? session : null;
  } catch {
    return null;
  }
}
