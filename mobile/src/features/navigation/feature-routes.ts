import { getAuthenticatedRole, type UserRole } from '@/features/auth/roles';

export type FeatureRoute = {
  slug: string;
  title: string;
  description: string;
  roles: UserRole[];
};

// Điều hướng demo theo ba role trong seed RBAC. Backend vẫn kiểm tra quyền API.
export const featureRoutes: FeatureRoute[] = [
  {
    slug: 'create-medical-record',
    title: 'Tạo bệnh án',
    description: 'Trả lời câu hỏi phân loại và điền phiếu khám.',
    roles: ['doctor', 'patient'],
  },
  {
    slug: 'my-medical-records',
    title: 'Bệnh án của tôi',
    description: 'Theo dõi bệnh án và lịch sử khám.',
    roles: ['patient'],
  },
  {
    slug: 'lesion-tracking',
    title: 'Theo dõi tổn thương',
    description: 'Ghi nhận đợt tổn thương và hình ảnh theo mốc.',
    roles: ['patient', 'doctor', 'admin'],
  },
  {
    slug: 'uas7',
    title: 'Chấm điểm UAS7',
    description: 'Chấm điểm hằng ngày và xem tổng tuần.',
    roles: ['patient', 'doctor', 'admin'],
  },
  {
    slug: 'my-results',
    title: 'Kết quả và đơn thuốc',
    description: 'Xem xét nghiệm và đơn thuốc đã được bác sĩ ghi nhận.',
    roles: ['patient'],
  },
  {
    slug: 'pending-records',
    title: 'Bệnh án chờ',
    description: 'Xem và tiếp nhận bệnh án đang chờ xử lý.',
    roles: ['doctor'],
  },
  {
    slug: 'in-progress-records',
    title: 'Đang khám',
    description: 'Tiếp tục các bệnh án đã được tiếp nhận.',
    roles: ['doctor'],
  },
  {
    slug: 'patients',
    title: 'Bệnh nhân',
    description: 'Tìm kiếm và xem hồ sơ bệnh nhân.',
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
  {
    slug: 'templates',
    title: 'Mẫu phiếu',
    description: 'Tra cứu mẫu phiếu khám được cấp quyền.',
    roles: ['patient', 'doctor', 'admin'],
  },
  {
    slug: 'admin-medical-records',
    title: 'Quản lý bệnh án',
    description: 'Tra cứu bệnh án theo trạng thái và mở hồ sơ theo quyền được cấp.',
    roles: ['admin'],
  },
  {
    slug: 'admin-users',
    title: 'Người dùng',
    description: 'Quản lý người dùng, nhân viên và phân công theo quyền được cấp.',
    roles: ['admin'],
  },
  {
    slug: 'clinic-branches',
    title: 'Cơ sở khám',
    description: 'Quản trị viên quản lý; bác sĩ tra cứu chi nhánh, khoa và phòng được API cho phép.',
    roles: ['doctor', 'admin'],
  },
  {
    slug: 'access-control',
    title: 'Phân quyền',
    description: 'Tra cứu vai trò, quyền và API trong hệ thống.',
    roles: ['admin'],
  },
];

export function getDemoRole(roleId: number): UserRole | null {
  return getAuthenticatedRole(roleId);
}

export function getFeatureRoute(slug: string): FeatureRoute | undefined {
  return featureRoutes.find((item) => item.slug === slug);
}
