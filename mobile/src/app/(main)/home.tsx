
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { fontSizes, palette, typography } from '@/constants/typography';
import { roleLabels } from '@/features/auth/roles';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { DoctorHome } from '@/features/doctor/doctor-home';
import {
  getDemoRole,
  getFeatureRoute,
} from '@/features/navigation/feature-routes';

export default function HomeScreen() {
  const session = useAuthenticatedSession();
  const { width } = useWindowDimensions();

  const role = session
    ? getDemoRole(session.user.role_id)
    : null;

  const quickSlugs =
    role === 'patient'
      ? ['create-medical-record', 'my-medical-records', 'uas7']
      : role === 'admin'
        ? ['admin-users', 'clinic-branches', 'templates', 'access-control']
        : [];

  const quickFeatures = quickSlugs
    .map(getFeatureRoute)
    .filter((item) => item !== undefined);

  if (!session) {
    return <View style={styles.empty} />;
  }

  if (role === 'doctor') {
    return <DoctorHome fullName={session.user.full_name} />;
  }

  const firstName =
    session.user.full_name.trim().split(/\s+/).at(-1) ||
    session.user.full_name;

  const isAdmin = role === 'admin';
  const isWide = width >= 900;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        isWide && styles.contentWide,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>KHÔNG GIAN LÀM VIỆC</Text>

        <Text style={styles.greeting}>
          Xin chào, {firstName}!
        </Text>

        <Text style={styles.subtitle}>
          {role ? roleLabels[role] : 'Tài khoản'} · Chúc bạn một ngày làm việc hiệu quả.
        </Text>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCircle} />
        <View style={styles.heroCircleSmall} />

        <View style={styles.heroTop}>
          <Text style={styles.heroEyebrow}>MAY DAY HEALTHCARE</Text>

          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>✚</Text>
          </View>
        </View>

        <Text style={styles.heroTitle}>
          {isAdmin
            ? 'Chăm sóc tốt hơn,\nbắt đầu từ đây.'
            : 'Theo dõi sức khỏe\ntừng ngày.'}
        </Text>

        <Text style={styles.heroDescription}>
          {isAdmin
            ? 'Quản lý hệ thống và theo dõi quy trình chăm sóc sức khỏe trong cùng một không gian.'
            : 'Các chức năng giúp bạn theo dõi sức khỏe và quá trình điều trị một cách thuận tiện.'}
        </Text>
      </View>

      {quickFeatures.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeadingCopy}>
              <Text style={styles.sectionTitle}>
                {isAdmin ? 'Quản lý nhanh' : 'Chức năng của bạn'}
              </Text>

              <Text style={styles.sectionSubtitle}>
                {isAdmin
                  ? 'Các khu vực quản lý được cấp quyền'
                  : 'Truy cập nhanh các chức năng thường dùng'}
              </Text>
            </View>

            <View style={styles.sectionIcon}>
              <Text style={styles.sectionIconText}>✦</Text>
            </View>
          </View>

          <View style={styles.featureList}>
            {quickFeatures.map((feature, index) => (
              <FeatureCard
                feature={feature}
                index={index}
                key={feature.slug}
                prominent={index === 0}
              />
            ))}
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/account')}
          style={({ pressed }) => [
            styles.accountCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.accountIcon}>
            <Text style={styles.accountIconText}>♙</Text>
          </View>

          <View style={styles.accountContent}>
            <Text style={styles.accountCardTitle}>
              Thông tin tài khoản
            </Text>

            <Text style={styles.accountCardText}>
              Xem hồ sơ, bảo mật và email khôi phục.
            </Text>
          </View>

          <Text style={styles.accountArrow}>›</Text>
        </Pressable>
      )}

      <View style={styles.footer}>
        <View style={styles.footerDivider} />

        <Text style={styles.footerText}>
          MAY DAY HEALTHCARE SYSTEM
        </Text>

        <Text style={styles.footerCopyright}>
          © 2026 Bệnh viện Da Liễu Trung Ương
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  empty: {
    flex: 1,
    backgroundColor: palette.canvas,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 820,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 42,
  },
  contentWide: {
    maxWidth: 1080,
    paddingHorizontal: 32,
  },
  heading: {
    marginBottom: 4,
  },
  eyebrow: {
    color: palette.primary,
    fontFamily: typography.bold,
    fontSize: fontSizes.xs,
    letterSpacing: 1,
  },
  greeting: {
    marginTop: 10,
    color: palette.ink,
    fontFamily: typography.extraBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    marginTop: 8,
    color: palette.muted,
    fontFamily: typography.regular,
    fontSize: fontSizes.base,
    lineHeight: 23,
  },
  hero: {
    overflow: 'hidden',
    position: 'relative',
    marginTop: 26,
    borderRadius: 22,
    backgroundColor: palette.primary,
    paddingHorizontal: 25,
    paddingVertical: 27,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 4,
  },
  heroCircle: {
    position: 'absolute',
    width: 190,
    height: 190,
    right: -65,
    top: -90,
    borderWidth: 24,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 100,
  },
  heroCircleSmall: {
    position: 'absolute',
    width: 100,
    height: 100,
    right: 40,
    bottom: -75,
    borderWidth: 16,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 100,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    color: '#E5F5FF',
    fontFamily: typography.bold,
    fontSize: fontSizes.xs,
    letterSpacing: 1.1,
  },
  heroIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroIconText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  heroTitle: {
    marginTop: 18,
    color: '#FFFFFF',
    fontFamily: typography.extraBold,
    fontSize: 26,
    lineHeight: 36,
  },
  heroDescription: {
    maxWidth: 560,
    marginTop: 11,
    color: '#F0FAFF',
    fontFamily: typography.regular,
    fontSize: fontSizes.sm,
    lineHeight: 22,
  },
  section: {
    marginTop: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  sectionHeadingCopy: {
    flex: 1,
  },
  sectionTitle: {
    color: palette.ink,
    fontFamily: typography.bold,
    fontSize: fontSizes.xl,
  },
  sectionSubtitle: {
    marginTop: 5,
    color: palette.muted,
    fontFamily: typography.regular,
    fontSize: fontSizes.xs,
  },
  sectionIcon: {
    width: 39,
    height: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: palette.primarySoft,
  },
  sectionIconText: {
    color: palette.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  featureList: {
    gap: 12,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 30,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 17,
    backgroundColor: palette.surface,
    padding: 18,
    shadowColor: '#477C9A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  accountIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: palette.primarySoft,
  },
  accountIconText: {
    color: palette.primary,
    fontSize: 20,
  },
  accountContent: {
    flex: 1,
    minWidth: 0,
  },
  accountCardTitle: {
    color: palette.ink,
    fontFamily: typography.bold,
    fontSize: fontSizes.md,
  },
  accountCardText: {
    marginTop: 6,
    color: palette.muted,
    fontFamily: typography.regular,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  accountArrow: {
    color: palette.primary,
    fontSize: 24,
  },
  footer: {
    marginTop: 38,
    paddingTop: 18,
    alignItems: 'center',
  },
  footerDivider: {
    width: '100%',
    height: 1,
    marginBottom: 16,
    backgroundColor: palette.border,
  },
  footerText: {
    color: palette.muted,
    fontFamily: typography.medium,
    fontSize: fontSizes.xs,
  },
  footerCopyright: {
    marginTop: 6,
    color: '#9AAEBB',
    fontFamily: typography.regular,
    fontSize: fontSizes.xs,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
});
