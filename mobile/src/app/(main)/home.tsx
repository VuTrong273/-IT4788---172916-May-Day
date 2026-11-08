
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureCard } from '@/components/feature-card';
import { roleLabels } from '@/features/auth/roles';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { DoctorHome } from '@/features/doctor/doctor-home';
import {
  getDemoRole,
  getFeatureRoute,
} from '@/features/navigation/feature-routes';

const colors = {
  primary: '#168B78',
  primaryDark: '#117565',
  primaryLight: '#E5F3EF',
  canvas: '#F3F8F6',
  surface: '#FFFFFF',
  ink: '#263D39',
  muted: '#789089',
  border: '#E2ECE7',
  accent: '#DDF1EA',
};

export default function HomeScreen() {
  const session = useAuthenticatedSession();

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
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (role === 'doctor') {
    return <DoctorHome fullName={session.user.full_name} />;
  }

  const firstName =
    session.user.full_name.trim().split(/\s+/).at(-1) ||
    session.user.full_name;

  const isAdmin = role === 'admin';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandIconText}>+</Text>
            </View>

            <View>
              <Text style={styles.brandName}>MAYDAY</Text>
              <Text style={styles.brandSubtitle}>
                Healthcare System
              </Text>
            </View>
          </View>

          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {isAdmin ? 'QUẢN TRỊ VIÊN' : 'BỆNH NHÂN'}
            </Text>
          </View>
        </View>

        {/* Greeting */}
        <View style={styles.greetingSection}>
          <Text style={styles.greetingEyebrow}>
            KHÔNG GIAN LÀM VIỆC
          </Text>

          <Text style={styles.greeting}>
            Xin chào, {firstName}!
          </Text>

          <Text style={styles.greetingSubtitle}>
            {role ? roleLabels[role] : 'Tài khoản'} ·
            {' '}Chúc bạn một ngày làm việc hiệu quả.
          </Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroDecoration} />

          <View style={styles.heroTop}>
            <Text style={styles.heroEyebrow}>
              MAYDAY HEALTHCARE
            </Text>

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

        {/* Quick features */}
        {quickFeatures.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
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
              pressed && styles.cardPressed,
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

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />

          <Text style={styles.footerText}>
            MAYDAY HEALTHCARE SYSTEM
          </Text>

          <Text style={styles.footerCopyright}>
            © 2026 Bệnh viện Da Liễu Trung Ương
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}



const styles = StyleSheet.create({
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#F0F8FD',
  },

  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E3EDF3',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#E5F4FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: {
    color: '#168ACB',
    fontSize: 19,
    fontWeight: '800',
  },
  brandName: {
    color: '#174B6D',
    fontSize: 18,
    fontWeight: '800',
  },
  brandSubtitle: {
    color: '#71899A',
    fontSize: 10,
    marginTop: 2,
  },
  headerBadge: {
    backgroundColor: '#E8F5FC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  headerBadgeText: {
    color: '#168ACB',
    fontSize: 11,
    fontWeight: '700',
  },

  // Greeting
  greetingSection: {
    marginBottom: 4,
  },
  greetingEyebrow: {
    color: '#168ACB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  greeting: {
    marginTop: 20,
    color: '#174B6D',
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  greetingSubtitle: {
    marginTop: 8,
    color: '#71899A',
    fontSize: 14,
    lineHeight: 22,
  },

  // Hero
  hero: {
    overflow: 'hidden',
    position: 'relative',
    marginTop: 28,
    borderRadius: 22,
    backgroundColor: '#168ACB',
    paddingHorizontal: 26,
    paddingVertical: 28,
    shadowColor: '#168ACB',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
  heroDecoration: {
    position: 'absolute',
    width: 170,
    height: 170,
    right: -65,
    top: -75,
    borderWidth: 25,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
  },
  heroAccent: {
    position: 'absolute',
    width: 170,
    height: 170,
    right: -65,
    top: -75,
    borderWidth: 25,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    color: '#E5F5FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  heroTitle: {
    marginTop: 18,
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 35,
  },
  heroDescription: {
    marginTop: 12,
    maxWidth: 560,
    color: '#F0FAFF',
    fontSize: 14,
    lineHeight: 22,
  },

  // Quick features
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    marginTop: 32,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sectionTitle: {
    color: '#174B6D',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#7B96A9',
    fontSize: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#E5F4FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIconText: {
    color: '#168ACB',
    fontSize: 17,
    fontWeight: '800',
  },
  sectionHint: {
    color: '#7B96A9',
    fontSize: 12,
  },
  featureList: {
    gap: 13,
  },

  // Account
  accountCard: {
    marginTop: 28,
    borderWidth: 1,
    borderColor: '#D9EAF4',
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 22,
    shadowColor: '#5B8EAA',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  accountIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#E5F4FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIconText: {
    color: '#168ACB',
    fontSize: 19,
    fontWeight: '800',
  },
  accountContent: {
    flex: 1,
  },
  accountCardTitle: {
    color: '#174B6D',
    fontSize: 17,
    fontWeight: '800',
  },
  accountCardText: {
    marginTop: 7,
    color: '#71899A',
    fontSize: 14,
    lineHeight: 22,
  },
  accountArrow: {
    color: '#168ACB',
    fontSize: 22,
    fontWeight: '700',
  },

  // Footer
  footer: {
    marginTop: 32,
    paddingTop: 18,
    alignItems: 'center',
  },
  footerDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#D9EAF4',
    marginBottom: 16,
  },
  footerText: {
    color: '#71899A',
    fontSize: 12,
    textAlign: 'center',
  },
  footerCopyright: {
    color: '#9AAEBB',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
});


