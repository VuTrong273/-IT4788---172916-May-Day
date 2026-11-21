import { getAuthenticatedRole, type UserRole } from '@/features/auth/roles';
import { canAccess } from '@/features/auth/permissions';
import type { Session } from '@/features/auth/session';

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
    description: 'Chọn mẫu phiếu theo hướng dẫn và điền phiếu khám.',
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
    roles: ['patient', 'doctor', 'admin'],
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

export function getDemoRole(roleId: unknown): UserRole | null {
  return getAuthenticatedRole(roleId);
}

export function getFeatureRoute(slug: string): FeatureRoute | undefined {
  return featureRoutes.find((item) => item.slug === slug);
}

const featureRequirements: Record<string, [string, string][]> = {
  'create-medical-record': [['POST','/medical_records'], ['GET','/templates/:id'], ['GET','/medical_records/classify-questions'], ['POST','/medical_records/classify']],
  'my-medical-records': [['GET','/medical_records/patients/:id/history']],
  'lesion-tracking': [['GET','/lesion-episodes/my']],
  'uas7': [['GET','/uas7-scores/patient/:patient_id']],
  'my-results': [['GET','/medical_records/patients/:id/history']],
  'pending-records': [['GET','/medical_records/all'], ['GET','/medical_records/:id']],
  'in-progress-records': [['GET','/medical_records/all'], ['GET','/medical_records/:id']],
  'patients': [['GET','/doctor/patients/search']],
  'lab-requests': [['GET','/medical_records/all'], ['GET','/medical_records/:id'], ['GET','/lab-results/:record_id']],
  'prescriptions': [['GET','/medical_records/all'], ['GET','/medical_records/:id'], ['GET','/prescriptions/:medical_record_id']],
  'templates': [['GET','/templates/all'], ['GET','/templates/:id']],
  'admin-medical-records': [['GET','/medical_records/all'], ['GET','/medical_records/:id']],
  'admin-users': [['GET','/admin/users']],
  'clinic-branches': [['GET','/branches'], ['GET','/departments'], ['GET','/rooms']],
  'access-control': [['GET','/roles'], ['GET','/permissions'], ['GET','/api_endpoints']],
};
export function canOpenFeature(session: Session | null, slug: string): boolean {
  const role = session ? getAuthenticatedRole(session.user) : null;
  const feature = getFeatureRoute(slug);
  if (!session || !role || !feature || (role === 'patient' && !feature.roles.includes(role))) return false;
  if (slug === 'create-medical-record' && role === 'admin') return false;
  if (slug === 'my-results') {
    const canReadResults = canAccess(session, 'GET', '/lab-results/:record_id') ||
      canAccess(session, 'GET', '/prescriptions/:medical_record_id');
    const canSelectRecord = role === 'patient'
      ? canAccess(session, 'GET', '/medical_records/patients/:id/history')
      : canAccess(session, 'GET', '/medical_records/all') && canAccess(session, 'GET', '/medical_records/:id');
    return canReadResults && canSelectRecord;
  }
  const requirements = featureRequirements[slug];
  if (!requirements) return false;
  if (slug === 'access-control' || slug === 'clinic-branches') return requirements.some(([method,path]) => canAccess(session,method,path));
  if (slug === 'lesion-tracking' && role !== 'patient') return canAccess(session,'GET','/lesion-episodes/record/:medical_record_id');
  return requirements.every(([method,path]) => canAccess(session,method,path));
}
