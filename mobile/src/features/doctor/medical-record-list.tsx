import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import {
  medicalRecordsApi,
  type MedicalRecordListItem,
  type MedicalRecordStatus,
  type PatientHistoryItem,
} from './medical-records-api';
import { getDemoRole } from '@/features/navigation/feature-routes';

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Ngày tạo không hợp lệ'
    : parsed.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function statusLabel(status: MedicalRecordStatus) {
  if (status === 'pending') return 'Chờ tiếp nhận';
  if (status === 'in_progress') return 'Đang khám';
  return 'Đã hoàn tất';
}

function RecordCard({
  id,
  patientId,
  templateId,
  status,
  createdAt,
}: {
  id: number;
  patientId: number;
  templateId?: string;
  status: MedicalRecordStatus;
  createdAt: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mở bệnh án ${id}, ${statusLabel(status)}`}
      onPress={() => router.push({ pathname: '/medical-records/[id]', params: { id: String(id) } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>Bệnh án #{id}</Text>
        <Text style={styles.status}>{statusLabel(status)}</Text>
      </View>
      <Text style={styles.cardDetail}>Bệnh nhân #{patientId}{templateId ? ` · Mẫu ${templateId}` : ''}</Text>
      <Text style={styles.date}>Tạo lúc {dateLabel(createdAt)}</Text>
      <Text style={styles.openAction}>Mở chi tiết ›</Text>
    </Pressable>
  );
}

export function MedicalRecordList({
  session,
  status,
  clinicalFocus,
}: {
  session: Session;
  status?: MedicalRecordStatus;
  clinicalFocus?: 'lab' | 'prescription';
}) {
  const [records, setRecords] = useState<MedicalRecordListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageRef = useRef(1);
  const [statusFilter, setStatusFilter] = useState<MedicalRecordStatus | undefined>(status);
  const [patientIdText, setPatientIdText] = useState('');
  const [appliedPatientId, setAppliedPatientId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (
    targetPage: number,
    targetStatus: MedicalRecordStatus | undefined,
    targetPatientId: number | undefined,
    active: () => boolean,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const result = await medicalRecordsApi.list(session, {
        status: targetStatus,
        page: targetPage,
        limit: 20,
        patient_id: targetPatientId,
      });
      if (active()) {
        setRecords(result.data);
        setTotal(result.total);
        setPage(result.page);
        pageRef.current = result.page;
      }
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được bệnh án.');
    } finally {
      if (active()) setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(pageRef.current, statusFilter, appliedPatientId, () => active);
    return () => { active = false; };
  }, [load, statusFilter, appliedPatientId]));

  const isPendingQueue = status === 'pending';
  const isInProgressQueue = status === 'in_progress';
  const isDoctor = getDemoRole(session.user.role_id) === 'doctor';
  const title = clinicalFocus === 'lab'
    ? 'Xét nghiệm theo bệnh án'
    : clinicalFocus === 'prescription'
      ? 'Đơn thuốc theo bệnh án'
      : isPendingQueue ? 'Bệnh án chờ' : isInProgressQueue ? 'Đang khám' : 'Quản lý bệnh án';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BỆNH ÁN / {status === undefined ? 'QUẢN LÝ' : 'BÁC SĨ'}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {clinicalFocus
            ? 'Chọn một bệnh án đang khám để xem kết quả xét nghiệm và thực hiện các thao tác được máy chủ cho phép.'
            : isPendingQueue
            ? 'Hồ sơ đang chờ bác sĩ tiếp nhận.'
            : isInProgressQueue
              ? 'Các bệnh án đã được tiếp nhận và đang xử lý.'
              : 'Tra cứu bệnh án theo trạng thái. Quyền xem/xóa vẫn do máy chủ quyết định.'}
        </Text>
        {isDoctor ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/feature/create-medical-record')}
            style={styles.createButton}>
            <Text style={styles.createButtonText}>Tạo bệnh án cho bệnh nhân</Text>
          </Pressable>
        ) : null}

        {status === undefined ? (
          <View style={styles.filters} accessibilityLabel="Lọc trạng thái bệnh án">
            {([
              { label: 'Tất cả', value: undefined },
              { label: 'Chờ', value: 'pending' },
              { label: 'Đang khám', value: 'in_progress' },
              { label: 'Hoàn tất', value: 'completed' },
            ] as const).map((filter) => {
              const selected = statusFilter === filter.value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={filter.label}
                  onPress={() => {
                    if (statusFilter !== filter.value) {
                      setStatusFilter(filter.value);
                      setPage(1);
                      pageRef.current = 1;
                    }
                  }}
                  style={[styles.filterButton, selected && styles.filterSelected]}>
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <View style={styles.patientFilter}>
          <TextInput
            accessibilityLabel="Lọc theo mã bệnh nhân"
            keyboardType="number-pad"
            onChangeText={setPatientIdText}
            placeholder="Mã bệnh nhân (tùy chọn)"
            style={styles.patientInput}
            value={patientIdText}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              const value = patientIdText.trim();
              const parsed = value ? Number(value) : undefined;
              if (value && (!parsed || !Number.isSafeInteger(parsed) || parsed < 1)) {
                setError('Mã bệnh nhân phải là số nguyên dương.');
                return;
              }
              const changed = parsed !== appliedPatientId;
              setAppliedPatientId(parsed);
              setPage(1);
              pageRef.current = 1;
              if (!changed) void load(1, statusFilter, parsed, () => true);
            }}
            style={styles.applyFilterButton}>
            <Text style={styles.applyFilterText}>Lọc</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
        {!loading && !error ? (
          <View style={styles.summary}>
            <Text style={styles.summaryText}>Tổng cộng: {total}</Text>
            <Text style={styles.pageText}>Trang {page} · 20 mục/trang</Text>
          </View>
        ) : null}
        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.message}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load(page, statusFilter, appliedPatientId, () => true)}>
              <Text style={styles.actionText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && records.length === 0 ? (
          <View style={styles.message}>
            <Text style={styles.emptyTitle}>Chưa có bệnh án</Text>
            <Text style={styles.muted}>Máy chủ trả về danh sách rỗng cho bộ lọc đã chọn.</Text>
          </View>
        ) : null}
        {!loading && !error ? records.map((record) => (
          <RecordCard
            key={record.medical_record_id}
            id={record.medical_record_id}
            patientId={record.patient_id}
            templateId={record.template_id}
            status={record.status}
            createdAt={record.created_at}
          />
        )) : null}
        {!loading && !error && total > 20 ? (
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              disabled={page <= 1}
              onPress={() => void load(page - 1, statusFilter, appliedPatientId, () => true)}>
              <Text style={[styles.actionText, page <= 1 && styles.disabled]}>Trang trước</Text>
            </Pressable>
            <Text style={styles.muted}>{page} / {Math.ceil(total / 20)}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={page * 20 >= total}
              onPress={() => void load(page + 1, statusFilter, appliedPatientId, () => true)}>
              <Text style={[styles.actionText, page * 20 >= total && styles.disabled]}>Trang sau</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export function MedicalRecordHistory({ session }: { session: Session }) {
  const [records, setRecords] = useState<PatientHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const history = await medicalRecordsApi.history(session, session.user.user_id);
      if (active()) setRecords(history);
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được lịch sử bệnh án.');
    } finally {
      if (active()) setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  return (
    <View>
      {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
      {error ? (
        <View accessibilityLiveRegion="polite" style={styles.message}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load(() => true)}>
            <Text style={styles.actionText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : null}
      {!loading && !error && records.length === 0 ? (
        <View style={styles.message}>
          <Text style={styles.emptyTitle}>Chưa có bệnh án</Text>
          <Text style={styles.muted}>Bệnh án đã được tạo sẽ xuất hiện tại đây.</Text>
        </View>
      ) : null}
      {!loading && !error ? records.map((record) => (
        <RecordCard
          key={record.medical_record_id}
          id={record.medical_record_id}
          patientId={session.user.user_id}
          status={record.status}
          createdAt={record.created_at}
        />
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 40 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  summary: { marginTop: 23, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  createButton: { minHeight: 46, alignSelf: 'flex-start', justifyContent: 'center', marginTop: 18, paddingHorizontal: 15, borderRadius: 13, backgroundColor: appColors.primary },
  createButtonText: { color: appColors.surface, fontSize: 13, fontWeight: '800' },
  summaryText: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  pageText: { color: appColors.muted, fontSize: 12 },
  card: { marginBottom: 11, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  cardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  status: { color: appColors.primaryDark, fontSize: 12, fontWeight: '700' },
  cardDetail: { marginTop: 9, color: appColors.muted, fontSize: 13 },
  date: { marginTop: 12, color: appColors.muted, fontSize: 12 },
  openAction: { marginTop: 13, color: appColors.primary, fontSize: 13, fontWeight: '800' },
  message: { marginTop: 15, marginBottom: 12, padding: 22, borderRadius: 18, backgroundColor: appColors.surface },
  emptyTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800', marginBottom: 7 },
  muted: { color: appColors.muted, fontSize: 13, lineHeight: 19 },
  errorText: { color: '#B42336', fontSize: 14, marginBottom: 12, lineHeight: 20 },
  actionText: { color: appColors.primary, fontSize: 14, fontWeight: '800' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  patientFilter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  patientInput: { minHeight: 44, flex: 1, minWidth: 140, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, backgroundColor: appColors.surface, color: appColors.ink, paddingHorizontal: 12, fontSize: 14 },
  applyFilterButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 17, borderRadius: 12, backgroundColor: appColors.primary },
  applyFilterText: { color: appColors.surface, fontSize: 13, fontWeight: '800' },
  filterButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  filterSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  filterText: { color: appColors.muted, fontSize: 12, fontWeight: '700' },
  filterTextSelected: { color: appColors.primaryDark },
  disabled: { opacity: 0.35 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  loading: { marginTop: 30, marginBottom: 18 },
  pressed: { opacity: 0.75 },
});
