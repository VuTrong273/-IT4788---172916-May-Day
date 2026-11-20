export type UserRole = "admin" | "doctor";

export type AuthUser = {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
  base_role?: "admin" | "doctor" | "patient" | null;
};

export type Session = {
  token: string;
  user: AuthUser;
};

export function roleFromId(
  roleId: number | { role_id: number; base_role?: string | null },
): UserRole | null {
  if (typeof roleId === "object") {
    if ("base_role" in roleId)
      return roleId.base_role === "admin" || roleId.base_role === "doctor"
        ? roleId.base_role
        : null;
    return roleFromId(roleId.role_id);
  }
  if (roleId === 1) return "admin";
  if (roleId === 2) return "doctor";
  return null;
}

export function roleLabel(role: UserRole): string {
  return role === "admin" ? "Quản trị viên" : "Bác sĩ";
}
