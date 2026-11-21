import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import { canAccess } from '@/features/auth/permissions';
import { getDemoRole } from '@/features/navigation/feature-routes';
import { medicalRecordsApi, type MedicalRecord, type PatientHistoryItem } from '@/features/doctor/medical-records-api';
import { ClinicalRecordPanel } from './clinical-record-panel';

type Mode = 'lab' | 'prescription';

export function ClinicalWorkspace({ session, recordId, initialMode = 'lab' }: {
  session: Session;
  recordId?: number;
  initialMode?: Mode;
}) {
  const [history, setHistory] = useState<PatientHistoryItem[]>([]);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError('');
    setRecord(null);
    async function load() {
      if (recordId !== undefined) {
        if (!Number.isSafeInteger(recordId) || recordId < 1) throw new Error('Mã bệnh án không hợp lệ.');
        if (!canAccess(session, 'GET', `/medical_records/${recordId}`)) throw new Error('Bạn chưa được cấp quyền xem bệnh án.');
        const data = await medicalRecordsApi.get(session, recordId);
        if (active) setRecord(data);
      } else {
        const data = await medicalRecordsApi.history(session, session.user.user_id);
        if (active) {
          const sorted = [...data].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
          setHistory(sorted);
          setSelectedId((current) => sorted.some((item) => item.medical_record_id === current) ? current : sorted[0]?.medical_record_id ?? null);
        }
      }
    }
    void load().catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Không tải được thông tin điều trị.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  // The retry counter intentionally restarts the focused request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, recordId, revision]));

  const id = recordId ?? selectedId;
  const selected = record ?? history.find((item) => item.medical_record_id === selectedId);
  const modes: { value: Mode; label: string; allowed: boolean }[] = [
    { value: 'lab', label: 'Kết quả xét nghiệm', allowed: !!id && canAccess(session, 'GET', `/lab-results/${id}`) },
    { value: 'prescription', label: 'Đơn thuốc', allowed: !!id && canAccess(session, 'GET', `/prescriptions/${id}`) },
  ];
  const available = modes.filter((item) => item.allowed);
  const activeMode = available.find((item) => item.value === mode)?.value ?? available[0]?.value;
  const canWrite = !!record && getDemoRole(session.user) === 'doctor' &&
    record.assigned_doctor_id === session.user.user_id && record.status === 'in_progress';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>THÔNG TIN ĐIỀU TRỊ</Text>
        <Text style={styles.title}>{recordId ? initialMode === 'lab' ? 'Xét nghiệm' : 'Đơn thuốc' : 'Kết quả và đơn thuốc'}</Text>
        <Text style={styles.description}>{recordId ? `Bệnh án #${recordId}` : 'Chọn lần khám để xem kết quả và hướng dẫn dùng thuốc của bác sĩ.'}</Text>
        {loading ? <ActivityIndicator accessibilityLabel="Đang tải thông tin điều trị" color={appColors.primary} style={styles.loading} /> : null}
        {error ? <View style={styles.card} accessibilityLiveRegion="polite"><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" style={styles.action} onPress={() => setRevision((value) => value + 1)}><Text style={styles.link}>Thử lại</Text></Pressable></View> : null}
        {!loading && !error ? <>
          {!recordId && history.length === 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Chưa có lịch sử khám</Text><Text style={styles.description}>Kết quả xét nghiệm và đơn thuốc sẽ xuất hiện theo từng bệnh án sau khi bác sĩ ghi nhận.</Text></View> : null}
          {!recordId && history.length ? <View style={styles.selector}>
            <Text style={styles.cardTitle}>Lần khám</Text>
            <View style={styles.recordOptions}>{history.map((item) => <Pressable key={item.medical_record_id} accessibilityRole="radio" accessibilityState={{ selected: selectedId === item.medical_record_id }} onPress={() => setSelectedId(item.medical_record_id)} style={[styles.recordOption, selectedId === item.medical_record_id && styles.selected]}>
              <Text style={styles.recordLabel}>#{item.medical_record_id}</Text><Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('vi-VN')}</Text>
            </Pressable>)}</View>
          </View> : null}
          {id && selected ? <>
            <View style={styles.tabs}>{available.map((item) => <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: activeMode === item.value }} onPress={() => setMode(item.value)} style={[styles.tab, activeMode === item.value && styles.activeTab]}><Text style={[styles.tabText, activeMode === item.value && styles.activeText]}>{item.label}</Text></Pressable>)}</View>
            {activeMode ? <ClinicalRecordPanel key={`${id}-${activeMode}`} session={session} recordId={id} mode={activeMode} canWrite={canWrite} /> : <View style={styles.card}><Text style={styles.description}>Bạn chưa được cấp quyền xem kết quả hoặc đơn thuốc của bệnh án này.</Text></View>}
            {selected.instructions ? <View style={styles.card}><Text style={styles.cardTitle}>Lời dặn của bác sĩ</Text><Text style={styles.instructions}>{selected.instructions}</Text></View> : null}
            {canAccess(session, 'GET', `/medical_records/${id}`) ? <Pressable accessibilityRole="button" style={styles.action} onPress={() => router.push({ pathname: '/medical-records/[id]', params: { id: String(id) } })}><Text style={styles.link}>Xem đầy đủ bệnh án #{id} ›</Text></Pressable> : null}
          </> : null}
        </> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { padding: 20, paddingBottom: 36, width: '100%', maxWidth: 760, alignSelf: 'center' },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: appColors.ink, fontSize: 26, fontWeight: '800', marginTop: 8 },
  description: { color: appColors.muted, fontSize: 14, lineHeight: 22, marginTop: 6 },
  loading: { marginVertical: 28 },
  card: { padding: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  cardTitle: { color: appColors.ink, fontSize: 15, fontWeight: '700' },
  selector: { marginTop: 22, gap: 10 },
  recordOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recordOption: { paddingHorizontal: 14, paddingVertical: 10, minHeight: 48, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, backgroundColor: appColors.surface, gap: 3 },
  selected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  recordLabel: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  date: { color: appColors.muted, fontSize: 12 },
  tabs: { marginTop: 20, flexDirection: 'row', gap: 6, padding: 4, borderRadius: 12, backgroundColor: '#E6EFF5' },
  tab: { flex: 1, minHeight: 44, padding: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: appColors.surface },
  tabText: { color: appColors.muted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  activeText: { color: appColors.primary },
  instructions: { marginTop: 8, color: appColors.ink, fontSize: 14, lineHeight: 22 },
  error: { color: '#A62F3D', fontSize: 14, lineHeight: 21 },
  action: { minHeight: 44, justifyContent: 'center', marginTop: 12 },
  link: { color: appColors.primary, fontSize: 14, fontWeight: '700' },
});
