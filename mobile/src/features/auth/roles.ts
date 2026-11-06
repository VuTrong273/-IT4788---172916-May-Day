export type UserRole = 'patient' | 'doctor' | 'admin';

export function getAuthenticatedRole(roleId: unknown): UserRole | null {
  if (roleId === 1) return 'admin';
  if (roleId === 2) return 'doctor';
  if (roleId === 3) return 'patient';
  return null;
}

export const roleOptions: {
  value: UserRole;
  label: string;
  description: string;
}[] = [
  {
    value: 'patient',
    label: 'Bệnh nhân',
    description: 'Tạo bệnh án, gửi ảnh và theo dõi UAS7.',
  },
  {
    value: 'doctor',
    label: 'Bác sĩ',
    description: 'Tiếp nhận, chẩn đoán và hoàn tất bệnh án.',
  },
  {
    value: 'admin',
    label: 'Quản trị viên',
    description: 'Quản lý người dùng, cơ sở khám và cấu hình hệ thống.',
  },
];

export const roleLabels: Record<UserRole, string> = {
  patient: 'Bệnh nhân',
  doctor: 'Bác sĩ',
  admin: 'Quản trị viên',
};

export function getUserRole(
  value: string | string[] | undefined,
): UserRole {
  if (value === 'doctor' || value === 'admin') {
    return value;
  }

  return 'patient';
}
