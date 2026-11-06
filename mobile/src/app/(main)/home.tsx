import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureCard } from '@/components/feature-card';
import { appColors } from '@/constants/app-theme';
import { roleLabels } from '@/features/auth/roles';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { DoctorHome } from '@/features/doctor/doctor-home';
import { getDemoRole, getFeatureRoute } from '@/features/navigation/feature-routes';

export default function HomeScreen() {
  const session = useAuthenticatedSession();
  const role = session ? getDemoRole(session.user.role_id) : null;
  const quickSlugs = role === 'patient'
    ? ['create-medical-record', 'my-medical-records', 'uas7']
    : role === 'admin'
      ? ['admin-users', 'clinic-branches', 'templates', 'access-control']
      : [];
  const quickFeatures = quickSlugs.map(getFeatureRoute).filter((item) => item !== undefined);

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  if (role === 'doctor') return <DoctorHome fullName={session.user.full_name} />;

  const firstName = session.user.full_name.trim().split(/\s+/).at(-1) || session.user.full_name;
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Xin chào, {firstName}</Text>
        <Text style={styles.greetingSubtitle}>
          {role ? roleLabels[role] : 'Tài khoản'} · Chọn công việc bạn muốn thực hiện
        </Text>

        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <Text style={styles.heroEyebrow}>MAY DAY / KHÔNG GIAN CỦA BẠN</Text>
          <Text style={styles.heroTitle}>
            {role === 'patient'
              ? 'Theo dõi sức khỏe\ntừng ngày'
              : role === 'admin'
                ? 'Quản lý không gian\nMay Day'
                : 'Không gian làm việc'}
          </Text>
          <Text style={styles.heroDescription}>
            {role === 'admin'
              ? 'Truy cập các khu vực quản lý phù hợp với quyền được cấp cho tài khoản.'
              : 'Các mục bên dưới đưa bạn đến đúng công việc cần làm. Những chức năng đang hoàn thiện sẽ được ghi rõ.'}
          </Text>
        </View>

        {quickFeatures.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{role === 'admin' ? 'Quản lý nhanh' : 'Truy cập nhanh'}</Text>
              <Text style={styles.sectionHint}>{role === 'admin' ? 'Theo quyền được cấp' : 'Dành cho bệnh nhân'}</Text>
            </View>
            <View style={styles.featureList}>
              {quickFeatures.map((feature, index) => (
                <FeatureCard feature={feature} index={index} key={feature.slug} prominent={index === 0} />
              ))}
            </View>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={styles.accountCard}>
            <Text style={styles.accountCardTitle}>Thông tin tài khoản</Text>
            <Text style={styles.accountCardText}>Xem hồ sơ, bảo mật và email khôi phục.</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 36 },
  greeting: { marginTop: 34, color: appColors.ink, fontSize: 30, fontWeight: '800' },
  greetingSubtitle: { marginTop: 7, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  hero: { overflow: 'hidden', marginTop: 27, borderRadius: 25, backgroundColor: appColors.primaryDark, padding: 25 },
  heroAccent: { position: 'absolute', width: 155, height: 155, right: -56, top: -65, borderWidth: 24, borderColor: '#0284C7', borderRadius: 90 },
  heroEyebrow: { color: '#BAE3F8', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { marginTop: 18, color: appColors.surface, fontSize: 25, fontWeight: '800', lineHeight: 33 },
  heroDescription: { marginTop: 12, color: '#E6F2FC', fontSize: 13, lineHeight: 20 },
  sectionHeader: { marginTop: 30, marginBottom: 14, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { color: appColors.ink, fontSize: 19, fontWeight: '800' },
  sectionHint: { color: appColors.muted, fontSize: 12 },
  featureList: { gap: 11 },
  accountCard: { marginTop: 28, borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface, padding: 20 },
  accountCardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  accountCardText: { marginTop: 7, color: appColors.muted, fontSize: 14, lineHeight: 21 },
});
