import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { MedicalRecordHistory } from '@/features/doctor/medical-record-list';
import { getDemoRole } from '@/features/navigation/feature-routes';

export default function RecordsScreen() {
  const session = useAuthenticatedSession();
  const isPatient = !!session && getDemoRole(session.user.role_id) === 'patient';

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  if (!isPatient) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>MAY DAY / BỆNH ÁN</Text>
          <Text style={styles.title}>Không thể mở trang</Text>
          <Text style={styles.subtitle}>Lịch sử bệnh án này chỉ dành cho bệnh nhân đang đăng nhập.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/home')} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Về trang chủ</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BỆNH ÁN / BỆNH NHÂN</Text>
        <Text style={styles.title}>Bệnh án của tôi</Text>
        <Text style={styles.subtitle}>Xem lịch sử khám do máy chủ trả về hoặc tạo bệnh án mới.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/feature/create-medical-record')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Tạo bệnh án</Text>
        </Pressable>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lịch sử khám</Text>
        </View>
        <MedicalRecordHistory session={session} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 42 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 20, paddingHorizontal: 20, borderRadius: 14, backgroundColor: appColors.primary, alignSelf: 'flex-start' },
  primaryText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  sectionHeader: { marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: appColors.ink, fontSize: 19, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
