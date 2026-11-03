export type UserRole = 'admin' | 'doctor';

export type AuthUser = {
  user_id: number;
  full_name: string;
  phone: string;
  role_id: number;
};

export type Session = {
  token: string;
  user: AuthUser;
};

export function roleFromId(roleId: number): UserRole | null {
  if (roleId === 1) return 'admin';
  if (roleId === 2) return 'doctor';
  return null;
}

export function roleLabel(role: UserRole): string {
  return role === 'admin' ? 'Quản trị viên' : 'Bác sĩ';
}
