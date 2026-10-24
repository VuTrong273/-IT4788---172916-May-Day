import { FeatureMenuScreen } from '@/components/feature-menu-screen';

export default function TrackingScreen() {
  return (
    <FeatureMenuScreen
      title="Theo dõi sức khỏe"
      subtitle="Ghi nhận triệu chứng và xem thông tin theo dõi của bạn."
      slugs={['lesion-tracking', 'uas7', 'my-results']}
    />
  );
}
