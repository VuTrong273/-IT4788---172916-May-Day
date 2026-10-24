import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import { medicalRecordsApi, type MedicalRecordListItem } from './medical-records-api';

function dateLabel(value: string) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function MedicalRecordList({ session, status }: { session: Session; status: 'pending' | 'in_progress' }) {
  const [records, setRecords] = useState<MedicalRecordListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, active: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await medicalRecordsApi.list(session, status, targetPage);
      if (active()) {
        setRecords(result.data);
        setTotal(result.total);
        setPage(targetPage);
      }
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được bệnh án.');
    } finally {
      if (active()) setLoading(false);
    }
  }, [session, status]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(1, () => active);
    return () => { active = false; };
  }, [load]));

  const pending = status === 'pending';
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BỆNH ÁN / BÁC SĨ</Text>
        <Text style={styles.title}>{pending ? 'Bệnh án chờ' : 'Đang khám'}</Text>
        <Text style={styles.subtitle}>{pending
          ? 'Hồ sơ bệnh nhân gửi lên và chưa có bác sĩ tiếp nhận.'
          : 'Các bệnh án bạn đã tiếp nhận và đang xử lý.'}</Text>
        <View style={styles.summary}><Text style={styles.summaryText}>Tổng cộng: {total}</Text></View>

        {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
        {error ? <View style={styles.message}><Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load(page, () => true)}><Text style={styles.actionText}>Thử lại</Text></Pressable>
        </View> : null}
        {!loading && !error && records.length === 0 ? (
          <View style={styles.message}><Text style={styles.emptyTitle}>Chưa có bệnh án</Text>
            <Text style={styles.muted}>{pending ? 'Bệnh án chờ tiếp nhận sẽ xuất hiện ở đây.' : 'Khi tiếp nhận bệnh án, bạn sẽ thấy hồ sơ tại đây.'}</Text>
          </View>
        ) : null}
        {!loading && !error ? records.map((record) => (
          <Pressable key={record.medical_record_id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/medical-records/[id]', params: { id: String(record.medical_record_id) } })}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.cardTop}><Text style={styles.cardTitle}>Bệnh án #{record.medical_record_id}</Text><Text style={styles.arrow}>›</Text></View>
            <Text style={styles.cardDetail}>Bệnh nhân #{record.patient_id} · Mẫu {record.template_id}</Text>
            <Text style={styles.date}>{dateLabel(record.created_at)}</Text>
          </Pressable>
        )) : null}
        {!loading && !error && total > 20 ? <View style={styles.pagination}>
          <Pressable disabled={page === 1} onPress={() => void load(page - 1, () => true)}><Text style={[styles.actionText, page === 1 && styles.disabled]}>Trang trước</Text></Pressable>
          <Text style={styles.muted}>{page} / {Math.ceil(total / 20)}</Text>
          <Pressable disabled={page * 20 >= total} onPress={() => void load(page + 1, () => true)}><Text style={[styles.actionText, page * 20 >= total && styles.disabled]}>Trang sau</Text></Pressable>
        </View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 40 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  summary: { marginTop: 25, marginBottom: 14 },
  summaryText: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  card: { marginBottom: 11, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  cardDetail: { marginTop: 9, color: appColors.muted, fontSize: 13 },
  date: { marginTop: 13, color: appColors.primaryDark, fontSize: 12, fontWeight: '700' },
  arrow: { color: appColors.primary, fontSize: 25 },
  message: { marginTop: 15, padding: 22, borderRadius: 18, backgroundColor: appColors.surface },
  emptyTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800', marginBottom: 7 },
  muted: { color: appColors.muted, fontSize: 13 },
  errorText: { color: '#B42336', fontSize: 14, marginBottom: 12 },
  actionText: { color: appColors.primary, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.35 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  loading: { marginTop: 30 },
  pressed: { opacity: 0.75 },
});
