import type { UserRole } from '@/features/auth/roles';

export type FeatureRoute = {
  slug: string;
  title: string;
  description: string;
  roles: UserRole[];
};

// Điều hướng demo theo ba role trong seed RBAC. Backend vẫn kiểm tra quyền API.
export const featureRoutes: FeatureRoute[] = [
  {
    slug: 'manage-templates',
    title: 'Mẫu phiếu',
    description: 'Tạo và xem các mẫu phiếu khám.',
    roles: ['admin'],
  },
  {
    slug: 'create-medical-record',
    title: 'Tạo lần khám',
    description: 'Trả lời câu hỏi phân loại và điền phiếu khám.',
    roles: ['patient'],
  },
  {
    slug: 'my-medical-records',
    title: 'Lần khám của tôi',
    description: 'Theo dõi lần khám và lịch sử khám.',
    roles: ['patient'],
  },
  {
    slug: 'lesion-tracking',
    title: 'Theo dõi tổn thương',
    description: 'Ghi nhận đợt tổn thương và hình ảnh theo mốc.',
    roles: ['patient'],
  },
  {
    slug: 'uas7',
    title: 'Chấm điểm UAS7',
    description: 'Chấm điểm hằng ngày và xem tổng tuần.',
    roles: ['patient'],
  },
  {
    slug: 'my-results',
    title: 'Kết quả và đơn thuốc',
    description: 'Xem xét nghiệm và đơn thuốc đã được bác sĩ ghi nhận.',
    roles: ['patient'],
  },
  {
    slug: 'pending-records',
    title: 'Lần khám chờ',
    description: 'Xem và tiếp nhận lần khám đang chờ xử lý.',
    roles: ['doctor'],
  },
  {
    slug: 'in-progress-records',
    title: 'Đang khám',
    description: 'Tiếp tục các lần khám đã được tiếp nhận.',
    roles: ['doctor'],
  },
  {
    slug: 'patients',
    title: 'Bệnh nhân',
    description: 'Tìm bệnh nhân, tạo hồ sơ mới và xem lịch sử lần khám.',
    roles: ['doctor'],
  },
  {
    slug: 'completed-records',
    title: 'Đã hoàn tất',
    description: 'Tra cứu các lần khám bạn đã khám và hoàn tất.',
    roles: ['doctor'],
  },
  {
    slug: 'lab-requests',
    title: 'Xét nghiệm',
    description: 'Tạo chỉ định và cập nhật kết quả xét nghiệm.',
    roles: ['doctor'],
  },
  {
    slug: 'prescriptions',
    title: 'Đơn thuốc',
    description: 'Kê đơn và ghi chỉ dẫn cho bệnh nhân.',
    roles: ['doctor'],
  },
];

export function getDemoRole(roleId: number): UserRole | null {
  if (roleId === 1) return 'admin';
  if (roleId === 2) return 'doctor';
  if (roleId === 3) return 'patient';
  return null;
}

export function getFeatureRoute(slug: string): FeatureRoute | undefined {
  return featureRoutes.find((item) => item.slug === slug);
}
