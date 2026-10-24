import { FeatureMenuScreen } from '@/components/feature-menu-screen';

export default function PatientsScreen() {
  return (
    <FeatureMenuScreen
      title="Bệnh nhân"
      subtitle="Tra cứu và quản lý hồ sơ bệnh nhân theo quyền được cấp."
      slugs={['patients']}
    />
  );
}
