export type UserRole = 'patient' | 'doctor' | 'admin';

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
    description: 'Quản trị hệ thống trên Web app.',
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
