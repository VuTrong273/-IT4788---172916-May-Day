import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import { patientRecordsApi, type PatientRecord } from './patient-records-api';

export function MyMedicalRecords({ session }: { session: Session }) {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await patientRecordsApi.history(session);
      if (active()) setRecords(result);
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được lần khám.');
    } finally { if (active()) setLoading(false); }
  }, [session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  return <SafeAreaView style={styles.safeArea} edges={['bottom']}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>BỆNH ÁN / BỆNH NHÂN</Text>
    <Text style={styles.title}>Lần khám của tôi</Text>
    <Text style={styles.subtitle}>Theo dõi trạng thái hồ sơ đã gửi.</Text>
    {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
    {error ? <View style={styles.message}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void load(() => true)}><Text style={styles.retry}>Thử lại</Text></Pressable></View> : null}
    {!loading && !error && records.length === 0 ? <View style={styles.message}>
      <Text style={styles.cardTitle}>Bạn chưa có lần khám</Text>
      <Text style={styles.subtitle}>Tạo lần khám để gửi tới bác sĩ.</Text>
      <Pressable onPress={() => router.push({ pathname: '/feature/[slug]', params: { slug: 'create-medical-record' } })}><Text style={styles.retry}>Tạo lần khám</Text></Pressable>
    </View> : null}
    {!loading && !error ? records.map((record) => <Pressable key={record.medical_record_id}
      accessibilityRole="button" onPress={() => router.push({ pathname: '/medical-records/[id]', params: { id: String(record.medical_record_id) } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Text style={styles.cardTitle}>Lần khám #{record.medical_record_id}</Text>
      <Text style={styles.status}>{record.status === 'pending' ? 'Chờ tiếp nhận' : record.status === 'in_progress' ? 'Đang khám' : 'Đã hoàn tất'}</Text>
      <Text style={styles.date}>{new Date(record.created_at).toLocaleString('vi-VN')}</Text>
    </Pressable>) : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 42 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  loading: { marginTop: 30 },
  message: { marginTop: 24, padding: 20, borderRadius: 18, backgroundColor: appColors.surface },
  card: { marginTop: 14, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  cardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  status: { marginTop: 8, color: appColors.primaryDark, fontSize: 13, fontWeight: '700' },
  date: { marginTop: 12, color: appColors.muted, fontSize: 12 },
  error: { color: '#B42336', fontSize: 14, marginBottom: 10 },
  retry: { marginTop: 13, color: appColors.primary, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
