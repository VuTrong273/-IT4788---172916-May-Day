import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { medicalRecordsApi, type MedicalRecord, type MedicalRecordSummary } from '@/features/doctor/medical-records-api';
import { getDemoRole } from '@/features/navigation/feature-routes';

function dateLabel(value: string) {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MedicalRecordDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const session = useAuthenticatedSession();
  const id = Number(rawId);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [summary, setSummary] = useState<MedicalRecordSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active: () => boolean) => {
    if (!session || !Number.isSafeInteger(id) || id < 1) {
      if (active()) { setError('Mã bệnh án không hợp lệ.'); setLoading(false); }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detail, brief] = await Promise.all([
        medicalRecordsApi.get(session, id), medicalRecordsApi.summary(session, id),
      ]);
      if (active()) { setRecord(detail); setSummary(brief); }
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được bệnh án.');
    } finally {
      if (active()) setLoading(false);
    }
  }, [session, id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  async function accept() {
    if (!session || !record || saving) return;
    setSaving(true);
    setError(null);
    try {
      await medicalRecordsApi.accept(session, record.medical_record_id);
      setConfirming(false);
      await load(() => true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tiếp nhận được bệnh án.');
    } finally {
      setSaving(false);
    }
  }

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  const isDoctor = getDemoRole(session.user.role_id) === 'doctor';
  const canAccept = isDoctor && record?.status === 'pending' && record.assigned_doctor_id === null;

  return <SafeAreaView style={styles.safeArea} edges={['bottom']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>BỆNH ÁN / CHI TIẾT</Text>
      <Text style={styles.title}>Bệnh án #{rawId}</Text>
      {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
      {error ? <View style={styles.message}><Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => void load(() => true)}><Text style={styles.retry}>Tải lại</Text></Pressable>
      </View> : null}
      {!loading && record ? <>
        <View style={styles.card}>
          <Text style={styles.label}>BỆNH NHÂN</Text>
          <Text style={styles.value}>{summary?.patient_name || `Bệnh nhân #${record.patient_id}`}</Text>
          <Text style={styles.secondary}>Mã bệnh nhân: {record.patient_id}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>TRẠNG THÁI</Text>
          <Text style={styles.value}>{record.status === 'pending' ? 'Chờ tiếp nhận' : record.status === 'in_progress' ? 'Đang khám' : 'Đã hoàn tất'}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>MẪU PHIẾU</Text>
          <Text style={styles.value}>{record.template_id}</Text>
          <Text style={styles.secondary}>Tạo lúc {dateLabel(record.created_at)}</Text>
        </View>

        {canAccept ? <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Tiếp nhận bệnh án</Text>
          <Text style={styles.secondary}>Sau khi tiếp nhận, bệnh án được gán cho bạn và chuyển sang trạng thái đang khám.</Text>
          {confirming ? <>
            <Text style={styles.confirmText}>Xác nhận tiếp nhận bệnh án này?</Text>
            <Pressable disabled={saving} onPress={() => void accept()} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{saving ? 'Đang xử lý...' : 'Xác nhận tiếp nhận'}</Text>
            </Pressable>
            <Pressable disabled={saving} onPress={() => setConfirming(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Hủy</Text></Pressable>
          </> : <Pressable onPress={() => setConfirming(true)} style={styles.primaryButton}><Text style={styles.primaryText}>Tiếp nhận</Text></Pressable>}
        </View> : null}

        {record.status === 'in_progress' ? <View style={styles.message}>
          <Text style={styles.actionTitle}>Đang khám</Text>
          <Text style={styles.secondary}>Bệnh án đã được tiếp nhận. Phần câu trả lời, xét nghiệm và kê đơn sẽ được triển khai ở bước tiếp theo.</Text>
        </View> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 42 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  loading: { marginTop: 30 },
  card: { marginTop: 24, padding: 22, borderRadius: 20, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  label: { color: appColors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  value: { marginTop: 7, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  secondary: { marginTop: 7, color: appColors.muted, fontSize: 13, lineHeight: 20 },
  divider: { height: 1, backgroundColor: appColors.border, marginVertical: 18 },
  actionCard: { marginTop: 16, padding: 22, borderRadius: 20, backgroundColor: appColors.primarySoft },
  actionTitle: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  confirmText: { marginTop: 16, color: appColors.ink, fontSize: 14, fontWeight: '700' },
  primaryButton: { marginTop: 18, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: appColors.primary },
  primaryText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  cancelButton: { alignItems: 'center', padding: 15 },
  cancelText: { color: appColors.primaryDark, fontSize: 14, fontWeight: '700' },
  message: { marginTop: 18, padding: 20, borderRadius: 18, backgroundColor: appColors.surface },
  error: { color: '#B42336', fontSize: 14, marginBottom: 10 },
  retry: { color: appColors.primary, fontSize: 14, fontWeight: '800' },
});
