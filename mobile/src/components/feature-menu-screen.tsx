import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { getDemoRole, getFeatureRoute, type FeatureRoute } from '@/features/navigation/feature-routes';

import { FeatureCard } from './feature-card';

type Props = {
  title: string;
  subtitle: string;
  slugs: string[];
};

export function FeatureMenuScreen({ title, subtitle, slugs }: Props) {
  const session = useAuthenticatedSession();
  const role = session ? getDemoRole(session.user.role_id) : null;
  const features = slugs
    .map(getFeatureRoute)
    .filter((item): item is FeatureRoute => item !== undefined && role !== null && item.roles.includes(role));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>MAY DAY / CHỨC NĂNG</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {features.length > 0 ? (
          <View style={styles.list}>
            {features.map((feature, index) => (
              <FeatureCard feature={feature} index={index} key={feature.slug} />
            ))}
          </View>
        ) : session ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Chưa có chức năng phù hợp</Text>
            <Text style={styles.emptyText}>Mục này không thuộc vai trò của tài khoản đang đăng nhập.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 32, paddingBottom: 36 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 10, color: appColors.muted, fontSize: 15, lineHeight: 23 },
  list: { marginTop: 26, gap: 12 },
  emptyCard: { marginTop: 28, borderRadius: 18, backgroundColor: appColors.surface, padding: 20 },
  emptyTitle: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  emptyText: { marginTop: 7, color: appColors.muted, fontSize: 14, lineHeight: 21 },
});
