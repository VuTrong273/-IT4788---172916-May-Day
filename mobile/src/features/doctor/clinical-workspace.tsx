import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import {
  clinicalOrdersApi,
  type LabRequest,
  type Prescription,
} from './clinical-orders-api';
import type { MedicalRecordListItem } from './medical-records-api';

type WorkspaceMode = 'labs' | 'prescriptions';
type TestDraft = { test_name: string; description: string };
type MedicineDraft = {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instruction: string;
};
type ResultDraft = { result_value: string; result_note: string };

const emptyTest = (): TestDraft => ({ test_name: '', description: '' });
const emptyMedicine = (): MedicineDraft => ({
  medicine_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instruction: '',
});

export function ClinicalWorkspace({ session, mode }: { session: Session; mode: WorkspaceMode }) {
  const [records, setRecords] = useState<MedicalRecordListItem[]>([]);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [tests, setTests] = useState<TestDraft[]>([emptyTest()]);
  const [medicines, setMedicines] = useState<MedicineDraft[]>([emptyMedicine()]);
  const [note, setNote] = useState('');
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await clinicalOrdersApi.activeRecords(session);
      if (active()) setRecords(result);
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được bệnh án.');
    } finally {
      if (active()) setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadRecords(() => active);
    return () => { active = false; };
  }, [loadRecords]));

  const refreshSelected = useCallback(async () => {
    if (recordId === null) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'labs') {
        const requests = await clinicalOrdersApi.labRequests(session, recordId);
        setLabRequests(requests);
        const drafts: Record<string, ResultDraft> = {};
        for (const request of requests) {
          for (const item of request.items) {
            drafts[item.id] = {
              result_value: item.result_value ?? '',
              result_note: item.result_note ?? '',
            };
          }
        }
        setResultDrafts(drafts);
      } else {
        setPrescription(await clinicalOrdersApi.prescription(session, recordId));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [mode, recordId, session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (recordId !== null) {
      void refreshSelected().catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Không tải được dữ liệu.');
      });
    }
    return () => { active = false; };
  }, [recordId, refreshSelected]));

  function setTest(index: number, field: keyof TestDraft, value: string) {
    setTests((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item));
  }

  function setMedicine(index: number, field: keyof MedicineDraft, value: string) {
    setMedicines((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item));
  }

  function setResult(itemId: string, field: keyof ResultDraft, value: string) {
    setResultDrafts((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }));
  }

  async function createLabRequest() {
    if (recordId === null || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await clinicalOrdersApi.createLabRequest(session, {
        medical_record_id: String(recordId),
        note,
        items: tests.map((item) => ({ test_name: item.test_name, description: item.description })),
      });
      setTests([emptyTest()]);
      setNote('');
      setSuccess('Đã tạo phiếu chỉ định xét nghiệm.');
      await refreshSelected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tạo được phiếu xét nghiệm.');
    } finally {
      setSaving(false);
    }
  }

  async function saveResults(request: LabRequest) {
    if (saving) return;
    const results = request.items
      .filter((item) => resultDrafts[item.id]?.result_value.trim())
      .map((item) => ({
        lab_request_item_id: item.id,
        result_value: resultDrafts[item.id].result_value,
        result_note: resultDrafts[item.id].result_note,
      }));
    if (results.length === 0) {
      setError('Nhập kết quả ít nhất một xét nghiệm trước khi lưu.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await clinicalOrdersApi.enterLabResults(session, { lab_request_id: request.id, results });
      setSuccess('Đã lưu kết quả xét nghiệm.');
      await refreshSelected();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được kết quả xét nghiệm.');
    } finally {
      setSaving(false);
    }
  }

  async function createPrescription() {
    if (recordId === null || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await clinicalOrdersApi.createPrescription(session, {
        medical_record_id: String(recordId),
        note,
        items: medicines.map((item) => ({
          medicine_name: item.medicine_name,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          instruction: item.instruction,
        })),
      });
      setPrescription(created);
      setSuccess('Đã kê đơn thuốc cho bệnh án.');
      setMedicines([emptyMedicine()]);
      setNote('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tạo được đơn thuốc.');
    } finally {
      setSaving(false);
    }
  }

  const title = mode === 'labs' ? 'Xét nghiệm' : 'Đơn thuốc';
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>ĐIỀU TRỊ / BÁC SĨ</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {mode === 'labs'
            ? 'Chỉ định xét nghiệm và nhập kết quả theo từng bệnh án đang khám.'
            : 'Kê một đơn thuốc cho bệnh án đang khám.'}
        </Text>

        {recordId === null ? (
          <>
            <Text style={styles.sectionTitle}>Chọn bệnh án đang khám</Text>
            {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
            {error ? <Message text={error} error /> : null}
            {!loading && !error && records.length === 0 ? (
              <Message text="Bạn chưa có bệnh án đang khám được phân công." />
            ) : null}
            {!loading && records.map((record) => (
              <Pressable
                accessibilityRole="button"
                key={record.medical_record_id}
                onPress={() => {
                  setRecordId(record.medical_record_id);
                  setError(null);
                  setSuccess(null);
                }}
                style={({ pressed }) => [styles.recordCard, pressed && styles.pressed]}>
                <Text style={styles.cardTitle}>Bệnh án #{record.medical_record_id}</Text>
                <Text style={styles.secondary}>Bệnh nhân #{record.patient_id}</Text>
                <Text style={styles.secondary}>Mở lúc {new Date(record.created_at).toLocaleString('vi-VN')}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <View style={styles.selectedRow}>
              <Text style={styles.sectionTitle}>Bệnh án #{recordId}</Text>
              <Pressable onPress={() => { setRecordId(null); setError(null); setSuccess(null); }}>
                <Text style={styles.link}>Đổi bệnh án</Text>
              </Pressable>
            </View>
            {error ? <Message text={error} error /> : null}
            {success ? <Message text={success} /> : null}
            {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
            {!loading && mode === 'labs' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Tạo chỉ định mới</Text>
                  <Field label="Ghi chú chung" value={note} onChangeText={setNote} placeholder="Ví dụ: Nhịn ăn sáng" />
                  {tests.map((item, index) => (
                    <View key={`test-${index}`} style={styles.itemBlock}>
                      <Text style={styles.itemTitle}>Xét nghiệm {index + 1}</Text>
                      <Field label="Tên xét nghiệm *" value={item.test_name} onChangeText={(value) => setTest(index, 'test_name', value)} placeholder="Ví dụ: Công thức máu" />
                      <Field label="Mô tả" value={item.description} onChangeText={(value) => setTest(index, 'description', value)} placeholder="Ghi chú cho xét nghiệm" multiline />
                    </View>
                  ))}
                  <Pressable onPress={() => setTests((items) => [...items, emptyTest()])}><Text style={styles.link}>+ Thêm xét nghiệm</Text></Pressable>
                  <ActionButton label={saving ? 'Đang lưu...' : 'Tạo phiếu xét nghiệm'} disabled={saving} onPress={() => void createLabRequest()} />
                </View>

                <Text style={styles.sectionTitle}>Phiếu xét nghiệm</Text>
                {!labRequests.length ? <Message text="Bệnh án này chưa có chỉ định xét nghiệm." /> : null}
                {labRequests.map((request) => (
                  <View key={request.id} style={styles.card}>
                    <View style={styles.selectedRow}>
                      <Text style={styles.cardTitle}>Phiếu #{request.id}</Text>
                      <Text style={styles.status}>{statusLabel(request.status)}</Text>
                    </View>
                    {request.note ? <Text style={styles.secondary}>{request.note}</Text> : null}
                    {request.items.map((item) => (
                      <View key={item.id} style={styles.itemBlock}>
                        <Text style={styles.itemTitle}>{item.test_name}</Text>
                        {item.description ? <Text style={styles.secondary}>{item.description}</Text> : null}
                        <Field
                          label="Kết quả *"
                          value={resultDrafts[item.id]?.result_value ?? ''}
                          onChangeText={(value) => setResult(item.id, 'result_value', value)}
                          placeholder="Nhập kết quả"
                          multiline
                        />
                        <Field
                          label="Nhận xét"
                          value={resultDrafts[item.id]?.result_note ?? ''}
                          onChangeText={(value) => setResult(item.id, 'result_note', value)}
                          placeholder="Nhận xét của bác sĩ"
                          multiline
                        />
                      </View>
                    ))}
                    <ActionButton label={saving ? 'Đang lưu...' : 'Lưu kết quả'} disabled={saving} onPress={() => void saveResults(request)} />
                  </View>
                ))}
              </>
            ) : null}

            {!loading && mode === 'prescriptions' ? (
              prescription ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Đơn thuốc #{prescription.prescription_id}</Text>
                  {prescription.note ? <Text style={styles.secondary}>{prescription.note}</Text> : null}
                  {prescription.items.map((item) => (
                    <View key={item.prescription_item_id} style={styles.itemBlock}>
                      <Text style={styles.itemTitle}>{item.medicine_name}</Text>
                      <Text style={styles.secondary}>Liều dùng: {item.dosage}</Text>
                      <Text style={styles.secondary}>Tần suất: {item.frequency}</Text>
                      <Text style={styles.secondary}>Thời gian: {item.duration}</Text>
                      {item.instruction ? <Text style={styles.secondary}>Hướng dẫn: {item.instruction}</Text> : null}
                    </View>
                  ))}
                  <Text style={styles.caption}>Mỗi bệnh án chỉ tạo được một đơn thuốc.</Text>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Kê đơn thuốc</Text>
                  <Text style={styles.secondary}>Mỗi bệnh án chỉ có một đơn. Kiểm tra kỹ thông tin trước khi lưu.</Text>
                  <Field label="Ghi chú đơn thuốc" value={note} onChangeText={setNote} placeholder="Ví dụ: Tái khám sau 2 tuần" multiline />
                  {medicines.map((item, index) => (
                    <View key={`medicine-${index}`} style={styles.itemBlock}>
                      <Text style={styles.itemTitle}>Thuốc {index + 1}</Text>
                      <Field label="Tên thuốc *" value={item.medicine_name} onChangeText={(value) => setMedicine(index, 'medicine_name', value)} placeholder="Tên thuốc, hàm lượng" />
                      <Field label="Liều dùng *" value={item.dosage} onChangeText={(value) => setMedicine(index, 'dosage', value)} placeholder="Ví dụ: 1 viên" />
                      <Field label="Tần suất *" value={item.frequency} onChangeText={(value) => setMedicine(index, 'frequency', value)} placeholder="Ví dụ: 1 lần/ngày" />
                      <Field label="Thời gian *" value={item.duration} onChangeText={(value) => setMedicine(index, 'duration', value)} placeholder="Ví dụ: 7 ngày" />
                      <Field label="Hướng dẫn" value={item.instruction} onChangeText={(value) => setMedicine(index, 'instruction', value)} placeholder="Ví dụ: Uống sau ăn" multiline />
                    </View>
                  ))}
                  <Pressable onPress={() => setMedicines((items) => [...items, emptyMedicine()])}><Text style={styles.link}>+ Thêm thuốc</Text></Pressable>
                  <ActionButton label={saving ? 'Đang lưu...' : 'Lưu đơn thuốc'} disabled={saving} onPress={() => void createPrescription()} />
                </View>
              )
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appColors.muted}
        style={[styles.input, multiline && styles.multiline]}
        textAlignVertical={multiline ? 'top' : 'center'}
        value={value}
      />
    </View>
  );
}

function ActionButton({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, (pressed || disabled) && styles.pressed]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Message({ text, error = false }: { text: string; error?: boolean }) {
  return <View style={[styles.message, error && styles.errorMessage]}><Text style={error ? styles.errorText : styles.secondary}>{text}</Text></View>;
}

function statusLabel(status: LabRequest['status']) {
  if (status === 'completed') return 'Hoàn tất';
  if (status === 'in_progress') return 'Đang có kết quả';
  return 'Chờ kết quả';
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 42 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  sectionTitle: { marginTop: 25, marginBottom: 12, color: appColors.ink, fontSize: 17, fontWeight: '800' },
  loading: { marginTop: 25 },
  recordCard: { marginTop: 11, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  card: { marginTop: 15, padding: 19, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  cardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  itemTitle: { color: appColors.ink, fontSize: 14, fontWeight: '800' },
  secondary: { marginTop: 7, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  caption: { marginTop: 14, color: appColors.muted, fontSize: 12, lineHeight: 18 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  status: { color: appColors.primaryDark, fontSize: 12, fontWeight: '700' },
  link: { marginTop: 12, color: appColors.primary, fontSize: 14, fontWeight: '800' },
  itemBlock: { marginTop: 18, paddingTop: 15, borderTopWidth: 1, borderTopColor: appColors.border },
  field: { marginTop: 12 },
  fieldLabel: { marginBottom: 6, color: appColors.ink, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: appColors.ink, backgroundColor: '#FFFFFF', fontSize: 14 },
  multiline: { minHeight: 78 },
  actionButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 18, paddingHorizontal: 16, borderRadius: 13, backgroundColor: appColors.primary },
  actionText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  message: { marginTop: 13, padding: 16, borderRadius: 14, backgroundColor: appColors.surface },
  errorMessage: { borderWidth: 1, borderColor: '#F3B9C1', backgroundColor: '#FFF4F5' },
  errorText: { color: '#B42336', fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.72 },
});
