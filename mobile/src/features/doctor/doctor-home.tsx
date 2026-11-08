
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
import { appColors } from '@/constants/app-theme';
import { fontSizes, typography } from '@/constants/typography';
import { getFeatureRoute } from '@/features/navigation/feature-routes';

const workflow = [
  {
    step: '01',
    title: 'Tiếp nhận',
    detail: 'Xem bệnh án chờ và nhận hồ sơ phù hợp.',
  },
  {
    step: '02',
    title: 'Thăm khám',
    detail: 'Xem câu trả lời, ảnh, điểm theo dõi và bổ sung phần bác sĩ.',
  },
  {
    step: '03',
    title: 'Hoàn tất',
    detail: 'Ghi chỉ dẫn, chỉ định xét nghiệm hoặc kê đơn trước khi chốt.',
  },
];

const quickSlugs = [
  'in-progress-records',
  'patients',
  'lab-requests',
  'prescriptions',
];

type Props = {
  fullName: string;
};

export function DoctorHome({ fullName }: Props) {
  const firstName =
    fullName.trim().split(/\s+/).at(-1) || fullName;

  const quickFeatures = quickSlugs
    .map(getFeatureRoute)
    .filter((feature) => feature !== undefined);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <View>
          <Text style={styles.eyebrow}>KHÔNG GIAN BÁC SĨ</Text>
          <Text style={styles.greeting}>Chào bác sĩ {firstName}</Text>
          <Text style={styles.subtitle}>
            Các công việc khám bệnh được sắp theo đúng luồng xử lý.
          </Text>
        </View>

        {/* Pending records */}
        <View style={styles.hero}>
          <View style={styles.heroDecoration} />

          <Text style={styles.heroEyebrow}>BẮT ĐẦU CÔNG VIỆC</Text>
          <Text style={styles.heroTitle}>
            Bệnh án đang chờ tiếp nhận
          </Text>
          <Text style={styles.heroDescription}>
            Xem thông tin bệnh nhân gửi lên, sau đó tiếp nhận và xử lý bệnh án.
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/feature/[slug]',
                params: { slug: 'pending-records' },
              })
            }
            style={({ pressed }) => [
              styles.heroButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.heroButtonText}>Mở bệnh án chờ</Text>
            <Text style={styles.heroButtonArrow}>›</Text>
          </Pressable>
        </View>

        {/* Workflow */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quy trình xử lý</Text>

          <View style={styles.workflowCard}>
            {workflow.map((item, index) => (
              <View
                key={item.step}
                style={[
                  styles.workflowRow,
                  index !== workflow.length - 1 && styles.workflowDivider,
                ]}
              >
                <View style={styles.stepBadge}>
                  <Text style={styles.workflowStep}>{item.step}</Text>
                </View>

                <View style={styles.workflowCopy}>
                  <Text style={styles.workflowTitle}>{item.title}</Text>
                  <Text style={styles.workflowDetail}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lối vào nhanh</Text>

          <View style={styles.featureList}>
            {quickFeatures.map((feature, index) => (
              <FeatureCard
                key={feature.slug}
                feature={feature}
                index={index}
              />
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: appColors.canvas,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 38,
  },

  eyebrow: {
    color: appColors.primary,
    fontFamily: typography.bold,
    fontSize: fontSizes.xs,
    letterSpacing: 1,
  },
  greeting: {
    marginTop: 12,
    color: appColors.ink,
    fontFamily: typography.extraBold,
    fontSize: fontSizes['3xl'],
  },
  subtitle: {
    marginTop: 8,
    color: appColors.muted,
    fontFamily: typography.regular,
    fontSize: fontSizes.base,
    lineHeight: 22,
  },

  hero: {
    overflow: 'hidden',
    position: 'relative',
    marginTop: 26,
    borderRadius: 22,
    backgroundColor: appColors.primaryDark,
    padding: 24,
  },
  heroDecoration: {
    position: 'absolute',
    top: -65,
    right: -65,
    width: 180,
    height: 180,
    borderWidth: 24,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
  },
  heroEyebrow: {
    color: '#BAE3F8',
    fontFamily: typography.bold,
    fontSize: fontSizes.xs,
    letterSpacing: 1,
  },
  heroTitle: {
    maxWidth: 300,
    marginTop: 17,
    color: appColors.surface,
    fontFamily: typography.extraBold,
    fontSize: 25,
    lineHeight: 34,
  },
  heroDescription: {
    maxWidth: 360,
    marginTop: 9,
    color: '#E6F2FC',
    fontFamily: typography.regular,
    fontSize: fontSizes.sm,
    lineHeight: 21,
  },
  heroButton: {
    minHeight: 46,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 13,
    backgroundColor: appColors.surface,
    paddingHorizontal: 16,
  },
  heroButtonText: {
    color: appColors.primaryDark,
    fontFamily: typography.bold,
    fontSize: fontSizes.base,
  },
  heroButtonArrow: {
    color: appColors.primaryDark,
    fontSize: 24,
  },

  section: {
    marginTop: 29,
  },
  sectionTitle: {
    marginBottom: 13,
    color: appColors.ink,
    fontFamily: typography.bold,
    fontSize: fontSizes.xl,
  },
  workflowCard: {
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 18,
    backgroundColor: appColors.surface,
    paddingHorizontal: 18,
  },
  workflowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 16,
  },
  workflowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: appColors.border,
  },
  stepBadge: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: appColors.primarySoft,
  },
  workflowStep: {
    color: appColors.primary,
    fontFamily: typography.bold,
    fontSize: fontSizes.xs,
  },
  workflowCopy: {
    flex: 1,
  },
  workflowTitle: {
    color: appColors.ink,
    fontFamily: typography.bold,
    fontSize: fontSizes.md,
  },
  workflowDetail: {
    marginTop: 5,
    color: appColors.muted,
    fontFamily: typography.regular,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  featureList: {
    gap: 11,
  },
  pressed: {
    opacity: 0.78,
  },
});
