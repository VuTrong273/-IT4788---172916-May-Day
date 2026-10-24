import { FeatureMenuScreen } from '@/components/feature-menu-screen';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { getDemoRole } from '@/features/navigation/feature-routes';

export default function RecordsScreen() {
  const session = useAuthenticatedSession();
  const isDoctor = session && getDemoRole(session.user.role_id) === 'doctor';

  return (
    <FeatureMenuScreen
      title={isDoctor ? 'Bệnh án cần xử lý' : 'Bệnh án'}
      subtitle={isDoctor
        ? 'Tiếp nhận hồ sơ chờ, tiếp tục bệnh án đang khám và hoàn tất chỉ định.'
        : 'Tạo và theo dõi bệnh án của bạn.'}
      slugs={['create-medical-record', 'my-medical-records', 'pending-records', 'in-progress-records', 'lab-requests', 'prescriptions']}
    />
  );
}
