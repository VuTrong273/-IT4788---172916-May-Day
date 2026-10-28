import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FeatureCard } from '@/components/feature-card';
import { appColors } from '@/constants/app-theme';
import { getFeatureRoute } from '@/features/navigation/feature-routes';

const workflow = [
  { step: '01', title: 'Tiếp nhận', detail: 'Xem lần khám chờ và nhận hồ sơ phù hợp.' },
  { step: '02', title: 'Thăm khám', detail: 'Xem câu trả lời, ảnh, điểm theo dõi và bổ sung phần bác sĩ.' },
  { step: '03', title: 'Hoàn tất', detail: 'Ghi chỉ dẫn, chỉ định xét nghiệm hoặc kê đơn trước khi chốt.' },
];

const quickSlugs = ['in-progress-records', 'completed-records', 'patients', 'lab-requests', 'prescriptions'];

export function DoctorHome({ fullName }: { fullName: string }) {
  const firstName = fullName.trim().split(/\s+/).at(-1) || fullName;
  const initial = fullName.trim().charAt(0).toUpperCase() || 'B';
  const quickFeatures = quickSlugs.map(getFeatureRoute).filter((item) => item !== undefined);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>MAY DAY</Text>
            <Text style={styles.brandCaption}>Không gian bác sĩ</Text>
          </View>
          <Pressable
            accessibilityLabel="Mở trang tài khoản"
            accessibilityRole="button"
            onPress={() => router.push('/account')}
            style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </Pressable>
        </View>

        <Text style={styles.greeting}>Chào bác sĩ {firstName}</Text>
        <Text style={styles.greetingSubtitle}>Các công việc khám bệnh được sắp theo đúng luồng xử lý.</Text>

        <View style={styles.hero}>
          <View style={styles.heroAccent} />
          <Text style={styles.heroEyebrow}>BẮT ĐẦU CÔNG VIỆC</Text>
          <Text style={styles.heroTitle}>Lần khám đang chờ tiếp nhận</Text>
          <Text style={styles.heroDescription}>
            Xem thông tin bệnh nhân gửi lên, sau đó tiếp nhận và xử lý lần khám.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/feature/[slug]', params: { slug: 'pending-records' } })}
            style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
            <Text style={styles.heroButtonText}>Mở lần khám chờ</Text>
            <Text style={styles.heroButtonArrow}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Quy trình xử lý</Text>
        <View style={styles.workflowCard}>
          {workflow.map((item, index) => (
            <View key={item.step} style={[styles.workflowRow, index < workflow.length - 1 && styles.workflowDivider]}>
              <Text style={styles.workflowStep}>{item.step}</Text>
              <View style={styles.workflowCopy}>
                <Text style={styles.workflowTitle}>{item.title}</Text>
                <Text style={styles.workflowDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Lối vào nhanh</Text>
        <View style={styles.featureList}>
          {quickFeatures.map((feature, index) => (
            <FeatureCard feature={feature} index={index} key={feature.slug} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 38 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: appColors.primaryDark, fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  brandCaption: { marginTop: 4, color: appColors.muted, fontSize: 12 },
  avatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: appColors.primarySoft },
  avatarText: { color: appColors.primaryDark, fontSize: 19, fontWeight: '800' },
  greeting: { marginTop: 33, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  greetingSubtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  hero: { overflow: 'hidden', marginTop: 26, borderRadius: 24, backgroundColor: appColors.primaryDark, padding: 24 },
  heroAccent: { position: 'absolute', right: -70, top: -62, width: 180, height: 180, borderWidth: 25, borderColor: '#247660', borderRadius: 100 },
  heroEyebrow: { color: '#A9E2CB', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { maxWidth: 280, marginTop: 17, color: appColors.surface, fontSize: 25, fontWeight: '800', lineHeight: 32 },
  heroDescription: { maxWidth: 330, marginTop: 9, color: '#D5EDE3', fontSize: 13, lineHeight: 20 },
  heroButton: { minHeight: 46, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, backgroundColor: appColors.surface, paddingHorizontal: 16 },
  heroButtonText: { color: appColors.primaryDark, fontSize: 14, fontWeight: '800' },
  heroButtonArrow: { color: appColors.primaryDark, fontSize: 24 },
  sectionTitle: { marginTop: 29, marginBottom: 13, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  workflowCard: { borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface, paddingHorizontal: 18 },
  workflowRow: { flexDirection: 'row', gap: 14, paddingVertical: 16 },
  workflowDivider: { borderBottomWidth: 1, borderBottomColor: appColors.border },
  workflowStep: { color: appColors.primary, fontSize: 13, fontWeight: '800', paddingTop: 2 },
  workflowCopy: { flex: 1 },
  workflowTitle: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  workflowDetail: { marginTop: 5, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  featureList: { gap: 11 },
  pressed: { opacity: 0.78 },
});
