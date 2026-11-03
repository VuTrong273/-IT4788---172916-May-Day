import type { UserRole } from '@/features/auth/auth-types';
import type { IconName } from '@/components/ui/icon';

export type NavigationItem = { label: string; path: string; icon: IconName; roles: UserRole[] };

export const navigationItems: NavigationItem[] = [
  { label: 'Tổng quan', path: '/app', icon: 'dashboard', roles: ['doctor', 'admin'] },
  { label: 'Bệnh án', path: '/app/records', icon: 'records', roles: ['doctor', 'admin'] },
  { label: 'Bệnh nhân', path: '/app/patients', icon: 'patient', roles: ['doctor'] },
  { label: 'Tài khoản', path: '/app/users', icon: 'users', roles: ['admin'] },
  { label: 'Cơ sở khám', path: '/app/facilities', icon: 'facility', roles: ['admin'] },
  { label: 'Mẫu phiếu', path: '/app/templates', icon: 'template', roles: ['admin'] },
  { label: 'Phân quyền', path: '/app/access', icon: 'shield', roles: ['admin'] },
  { label: 'Xét nghiệm', path: '/app/labs', icon: 'lab', roles: ['doctor', 'admin'] },
  { label: 'Đơn thuốc', path: '/app/prescriptions', icon: 'prescription', roles: ['doctor', 'admin'] },
];
