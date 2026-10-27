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
    : role === 'admin' ? ['manage-templates'] : [];
  const quickFeatures = quickSlugs.map(getFeatureRoute).filter((item) => item !== undefined);

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  if (role === 'doctor') return <DoctorHome fullName={session.user.full_name} />;

  const firstName = session.user.full_name.trim().split(/\s+/).at(-1) || session.user.full_name;
  const initial = session.user.full_name.trim().charAt(0).toUpperCase() || 'M';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>MAY DAY</Text>
            <Text style={styles.brandCaption}>Không gian chăm sóc sức khỏe</Text>
          </View>
          <Pressable
            accessibilityLabel="Mở trang tài khoản"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
        </View>

        <Text style={styles.greeting}>Xin chào, {firstName}</Text>
        <Text style={styles.greetingSubtitle}>
          {role ? roleLabels[role] : 'Tài khoản'} · Chọn công việc bạn muốn thực hiện
        </Text>

        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <Text style={styles.heroEyebrow}>MAY DAY / KHÔNG GIAN CỦA BẠN</Text>
          <Text style={styles.heroTitle}>
            {role === 'patient' ? 'Theo dõi sức khỏe\ntừng ngày' : 'Quản lý hệ thống\nMay Day'}
          </Text>
          <Text style={styles.heroDescription}>
            {role === 'admin'
              ? 'Tạo và quản lý mẫu phiếu khám cho hệ thống.'
              : 'Các mục bên dưới đưa bạn đến đúng công việc cần làm. Những chức năng đang hoàn thiện sẽ được ghi rõ.'}
          </Text>
        </View>

        {quickFeatures.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
              <Text style={styles.sectionHint}>{role === 'admin' ? 'Dành cho quản trị viên' : 'Dành cho bệnh nhân'}</Text>
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: appColors.primaryDark, fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  brandCaption: { marginTop: 4, color: appColors.muted, fontSize: 12 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: appColors.primarySoft },
  avatarText: { color: appColors.primaryDark, fontSize: 19, fontWeight: '800' },
  greeting: { marginTop: 34, color: appColors.ink, fontSize: 30, fontWeight: '800' },
  greetingSubtitle: { marginTop: 7, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  hero: { overflow: 'hidden', marginTop: 27, borderRadius: 25, backgroundColor: appColors.primaryDark, padding: 25 },
  heroAccent: { position: 'absolute', width: 155, height: 155, right: -56, top: -65, borderWidth: 24, borderColor: '#1C745F', borderRadius: 90 },
  heroEyebrow: { color: '#A9E2CB', fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heroTitle: { marginTop: 18, color: appColors.surface, fontSize: 25, fontWeight: '800', lineHeight: 33 },
  heroDescription: { marginTop: 12, color: '#D5EDE3', fontSize: 13, lineHeight: 20 },
  sectionHeader: { marginTop: 30, marginBottom: 14, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { color: appColors.ink, fontSize: 19, fontWeight: '800' },
  sectionHint: { color: appColors.muted, fontSize: 12 },
  featureList: { gap: 11 },
  accountCard: { marginTop: 28, borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface, padding: 20 },
  accountCardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  accountCardText: { marginTop: 7, color: appColors.muted, fontSize: 14, lineHeight: 21 },
});
