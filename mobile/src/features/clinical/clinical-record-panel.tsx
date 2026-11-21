import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { appColors } from '@/constants/app-theme';
import { AppIcon } from '@/components/ui/app-icon';
import type { Session } from '@/features/auth/session';
import { canAccess } from '@/features/auth/permissions';
import {
  clinicalApi,
  type LabRequestWithResults,
  type Prescription,
  type PrescriptionItemInput,
} from './clinical-api';

type Props = {
  session: Session;
  recordId: number;
  canWrite: boolean;
  mode?: 'lab' | 'prescription' | 'both';
};

type PrescriptionDraft = PrescriptionItemInput;
type ResultDraft = { value: string; note: string };

const emptyPrescriptionItem = (): PrescriptionDraft => ({
  medicine_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instruction: '',
});

export function ClinicalRecordPanel({ session, recordId, canWrite, mode = 'both' }: Props) {
  const [labRequests, setLabRequests] = useState<LabRequestWithResults[] | null>(null);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [prescriptionLoaded, setPrescriptionLoaded] = useState(false);
  const [labError, setLabError] = useState<string | null>(null);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'lab' | 'prescription' | string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testNames, setTestNames] = useState('');
  const [labNote, setLabNote] = useState('');
  const [prescriptionNote, setPrescriptionNote] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionDraft[]>([emptyPrescriptionItem()]);
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});

  const load = useCallback(async (active: () => boolean = () => true) => {
    setLoading(true);
    setLabError(null);
    setPrescriptionError(null);
    const [labsResult, prescriptionResult] = await Promise.allSettled([
      mode !== 'prescription' && canAccess(session,'GET',`/lab-results/${recordId}`) ? clinicalApi.listLabResults(session, recordId) : Promise.resolve([]),
      mode !== 'lab' && canAccess(session,'GET',`/prescriptions/${recordId}`) ? clinicalApi.getPrescription(session, recordId) : Promise.resolve(null),
    ]);

    if (active()) {
      if (labsResult.status === 'fulfilled') {
        setLabRequests(labsResult.value);
        setResultDrafts((current) => {
          const next = { ...current };
          for (const request of labsResult.value) {
            for (const item of request.items) {
              if (!next[item.id] && item.result_value) {
                next[item.id] = { value: item.result_value, note: item.result_note ?? '' };
              }
            }
          }
          return next;
        });
      } else {
        setLabRequests(null);
        setLabError(labsResult.reason instanceof Error ? labsResult.reason.message : 'Không tải được dữ liệu xét nghiệm.');
      }

      if (prescriptionResult.status === 'fulfilled') {
        setPrescription(prescriptionResult.value);
        setPrescriptionLoaded(true);
      } else {
        setPrescription(null);
        setPrescriptionLoaded(false);
        setPrescriptionError(prescriptionResult.reason instanceof Error ? prescriptionResult.reason.message : 'Không tải được đơn thuốc.');
      }
      setLoading(false);
    }
  }, [recordId, session, mode]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  async function createLabRequest() {
    if (!canWrite || busy) return;
    const items = testNames
      .split(/\r?\n/)
      .map((test_name) => test_name.trim())
      .filter(Boolean)
      .map((test_name) => ({ test_name }));
    if (!items.length) {
      setLabError('Nhập tên mỗi xét nghiệm trên một dòng.');
      return;
    }
    setBusy('lab');
    setLabError(null);
    setSuccess(null);
    try {
      await clinicalApi.createLabRequest(session, recordId, { note: labNote, items });
      setTestNames('');
      setLabNote('');
      setSuccess('Máy chủ đã xác nhận tạo phiếu chỉ định.');
      await load();
    } catch (error) {
      setLabError(error instanceof Error ? error.message : 'Không tạo được phiếu xét nghiệm.');
    } finally {
      setBusy(null);
    }
  }

  async function createPrescription() {
    if (!canWrite || busy) return;
    const validItems = prescriptionItems.filter((item) =>
      item.medicine_name.trim() || item.dosage.trim() || item.frequency.trim() || item.duration.trim(),
    );
    if (!validItems.length) {
      setPrescriptionError('Nhập ít nhất một thuốc và đầy đủ liều dùng, tần suất, thời gian.');
      return;
    }
    setBusy('prescription');
    setPrescriptionError(null);
    setSuccess(null);
    try {
      await clinicalApi.createPrescription(session, recordId, {
        note: prescriptionNote,
        items: validItems,
      });
      setPrescriptionItems([emptyPrescriptionItem()]);
      setPrescriptionNote('');
      setSuccess('Máy chủ đã xác nhận tạo đơn thuốc.');
      await load();
    } catch (error) {
      setPrescriptionError(error instanceof Error ? error.message : 'Không tạo được đơn thuốc.');
    } finally {
      setBusy(null);
    }
  }

  async function submitLabResults(request: LabRequestWithResults) {
    if (!canWrite || busy) return;
    const results = request.items
      .map((item) => ({
        lab_request_item_id: item.id,
        result_value: resultDrafts[item.id]?.value ?? '',
        result_note: resultDrafts[item.id]?.note ?? '',
      }))
      .filter((result) => result.result_value.trim());
    if (!results.length) {
      setLabError('Nhập ít nhất một kết quả trước khi lưu.');
      return;
    }
    setBusy(request.id);
    setLabError(null);
    setSuccess(null);
    try {
      await clinicalApi.enterLabResults(session, {
        lab_request_id: request.id,
        results,
      });
      setSuccess('Máy chủ đã xác nhận lưu kết quả xét nghiệm.');
      await load();
    } catch (error) {
      setLabError(error instanceof Error ? error.message : 'Không lưu được kết quả xét nghiệm.');
    } finally {
      setBusy(null);
    }
  }

  function updatePrescriptionItem(index: number, field: keyof PrescriptionDraft, value: string) {
    setPrescriptionItems((current) => current.map((item, currentIndex) =>
      currentIndex === index ? { ...item, [field]: value } : item,
    ));
  }

  function updateResultDraft(itemId: string, field: keyof ResultDraft, value: string) {
    setResultDrafts((current) => ({
      ...current,
      [itemId]: { value: current[itemId]?.value ?? '', note: current[itemId]?.note ?? '', [field]: value },
    }));
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.kicker}>KẾT QUẢ / ĐIỀU TRỊ</Text>
          <Text style={styles.title}>{mode === 'lab' ? 'Kết quả xét nghiệm' : mode === 'prescription' ? 'Đơn thuốc' : 'Xét nghiệm và đơn thuốc'}</Text>
        </View>
        <Pressable accessibilityRole="button" disabled={loading} onPress={() => void load()} style={styles.refresh}>
          <AppIcon name="refresh" size={18} /><Text style={styles.refreshText}>{loading ? 'Đang tải...' : 'Tải lại'}</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
      {success ? <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text> : null}

      {mode !== 'prescription' && canAccess(session,'GET',`/lab-results/${recordId}`) ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chỉ định và kết quả xét nghiệm</Text>
        {labError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{labError}</Text> : null}
        {labRequests?.length === 0 ? <View style={styles.emptyState}><AppIcon name="labs" size={28} /><Text style={styles.itemTitle}>Chưa có chỉ định xét nghiệm</Text><Text style={styles.help}>Kết quả sẽ xuất hiện tại đây khi được cập nhật.</Text></View> : null}
        {labRequests?.map((request) => (
          <View key={request.id} style={styles.dataCard}>
            <View style={styles.dataHeading}><Text style={styles.cardTitle}>Phiếu #{request.id}</Text><Text style={styles.labBadge}>{labStatus(request.status)}</Text></View>
            {request.note ? <Text style={styles.help}>{request.note}</Text> : null}
            {request.items.map((item) => {
              const hasResult = item.result_value !== null && item.result_value !== undefined;
              return (
                <View key={item.id} style={styles.listItem}>
                  <Text style={styles.itemTitle}>{item.test_name}</Text>
                  {canWrite && canAccess(session,'POST','/lab-results') ? (
                    <>
                      {hasResult ? <Text style={styles.help}>Đã lưu trên máy chủ: {item.result_value}</Text> : null}
                      <TextInput
                        accessibilityLabel={`Kết quả ${item.test_name}`}
                        onChangeText={(value) => updateResultDraft(item.id, 'value', value)}
                        placeholder="Nhập kết quả"
                        style={styles.input}
                        value={resultDrafts[item.id]?.value ?? item.result_value ?? ''}
                      />
                      <TextInput
                        accessibilityLabel={`Ghi chú ${item.test_name}`}
                        onChangeText={(value) => updateResultDraft(item.id, 'note', value)}
                        placeholder="Ghi chú (không bắt buộc)"
                        style={styles.input}
                        value={resultDrafts[item.id]?.note ?? item.result_note ?? ''}
                      />
                    </>
                  ) : hasResult ? (
                    <>
                      <Text style={styles.value}>{item.result_value}</Text>
                      {item.result_note ? <Text style={styles.help}>{item.result_note}</Text> : null}
                    </>
                  ) : <Text style={styles.pendingResult}>Đang chờ kết quả</Text>}
                </View>
              );
            })}
            {canWrite && canAccess(session,'POST','/lab-results') && request.items.length > 0 ? (
              <Button
                disabled={busy !== null}
                label={busy === request.id ? 'Đang lưu...' : 'Lưu kết quả đã nhập'}
                onPress={() => void submitLabResults(request)}
              />
            ) : null}
          </View>
        ))}
        {canWrite && canAccess(session,'POST','/lab-requests') ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Tạo phiếu chỉ định</Text>
            <Text style={styles.help}>Nhập mỗi xét nghiệm trên một dòng; phiếu rỗng sẽ không được gửi.</Text>
            <TextInput
              accessibilityLabel="Danh sách xét nghiệm"
              multiline
              onChangeText={setTestNames}
              placeholder={'Ví dụ: Công thức máu\nIgE toàn phần'}
              style={[styles.input, styles.multiline]}
              value={testNames}
            />
            <TextInput
              accessibilityLabel="Ghi chú phiếu xét nghiệm"
              onChangeText={setLabNote}
              placeholder="Ghi chú (không bắt buộc)"
              style={styles.input}
              value={labNote}
            />
            <Button disabled={busy !== null} label={busy === 'lab' ? 'Đang gửi...' : 'Tạo chỉ định'} onPress={() => void createLabRequest()} />
          </View>
        ) : null}
      </View> : null}

      {mode !== 'lab' && canAccess(session,'GET',`/prescriptions/${recordId}`) ? <View style={styles.section}>
        <Text style={styles.sectionTitle}>Đơn thuốc</Text>
        {prescriptionError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{prescriptionError}</Text> : null}
        {prescriptionLoaded && !prescription ? (
          <View style={styles.emptyState}><AppIcon name="prescriptions" size={28} /><Text style={styles.itemTitle}>Chưa có đơn thuốc</Text><Text style={styles.help}>Đơn thuốc sẽ hiển thị sau khi bác sĩ kê đơn.</Text></View>
        ) : null}
        {prescription ? (
          <View style={styles.dataCard}>
            <View style={styles.dataHeading}><AppIcon name="prescriptions" size={22} /><Text style={styles.cardTitle}>Đơn thuốc #{prescription.prescription_id}</Text></View>
            {prescription.note ? <Text style={styles.help}>{prescription.note}</Text> : null}
            {prescription.items.map((item) => (
              <View key={item.prescription_item_id} style={styles.listItem}>
                <Text style={styles.itemTitle}>{item.medicine_name}</Text>
                <View style={styles.doseGrid}>
                  {[['Liều dùng', item.dosage], ['Tần suất', item.frequency], ['Thời gian', item.duration]].map(([label, value]) => <View key={label} style={styles.doseCell}><Text style={styles.doseLabel}>{label}</Text><Text style={styles.doseValue}>{value || 'Chưa ghi nhận'}</Text></View>)}
                </View>
                {item.instruction ? <Text style={styles.help}>{item.instruction}</Text> : null}
              </View>
            ))}
            {prescription.created_at ? <Text style={styles.help}>Kê lúc {dateLabel(prescription.created_at)}</Text> : null}
          </View>
        ) : null}
        {canWrite && canAccess(session,'POST','/prescriptions') && prescriptionLoaded && !prescription ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Kê đơn thuốc</Text>
            {prescriptionItems.map((item, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.itemTitle}>Thuốc {index + 1}</Text>
                <TextInput accessibilityLabel={`Tên thuốc ${index + 1}`} onChangeText={(value) => updatePrescriptionItem(index, 'medicine_name', value)} placeholder="Tên thuốc" style={styles.input} value={item.medicine_name} />
                <TextInput accessibilityLabel={`Liều dùng ${index + 1}`} onChangeText={(value) => updatePrescriptionItem(index, 'dosage', value)} placeholder="Liều dùng" style={styles.input} value={item.dosage} />
                <TextInput accessibilityLabel={`Tần suất ${index + 1}`} onChangeText={(value) => updatePrescriptionItem(index, 'frequency', value)} placeholder="Tần suất" style={styles.input} value={item.frequency} />
                <TextInput accessibilityLabel={`Thời gian dùng ${index + 1}`} onChangeText={(value) => updatePrescriptionItem(index, 'duration', value)} placeholder="Thời gian dùng" style={styles.input} value={item.duration} />
                <TextInput accessibilityLabel={`Hướng dẫn ${index + 1}`} onChangeText={(value) => updatePrescriptionItem(index, 'instruction', value)} placeholder="Hướng dẫn (không bắt buộc)" style={styles.input} value={item.instruction ?? ''} />
                {prescriptionItems.length > 1 ? (
                  <Pressable accessibilityRole="button" onPress={() => setPrescriptionItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Text style={styles.remove}>Xóa thuốc này</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setPrescriptionItems((current) => [...current, emptyPrescriptionItem()])} style={styles.addButton}>
              <Text style={styles.addText}>+ Thêm thuốc</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Ghi chú đơn thuốc"
              onChangeText={setPrescriptionNote}
              placeholder="Ghi chú đơn thuốc (không bắt buộc)"
              style={styles.input}
              value={prescriptionNote}
            />
            <Button disabled={busy !== null} label={busy === 'prescription' ? 'Đang gửi...' : 'Gửi đơn thuốc'} onPress={() => void createPrescription()} />
          </View>
        ) : null}
      </View> : null}
    </View>
  );
}

function labStatus(status: LabRequestWithResults['status']) {
  if (status === 'completed') return 'Hoàn tất';
  if (status === 'in_progress') return 'Đang xử lý';
  return 'Đang chờ';
}

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Thời gian không hợp lệ' : parsed.toLocaleString('vi-VN');
}

function Button({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 26, gap: 18 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1, minWidth: 0 },
  kicker: { color: appColors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.9 },
  title: { marginTop: 5, color: appColors.ink, fontSize: 20, fontWeight: '700' },
  section: { gap: 12, borderWidth: 1, borderColor: appColors.border, borderRadius: 16, backgroundColor: appColors.surface, padding: 16 },
  sectionTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  help: { color: appColors.muted, fontSize: 13, lineHeight: 19 },
  loading: { marginVertical: 6 },
  refresh: { minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: appColors.border, borderRadius: 10 },
  refreshText: { color: appColors.primary, fontWeight: '700' },
  success: { color: '#117447', fontSize: 14, fontWeight: '700' },
  error: { color: '#A62F3D', fontSize: 13, lineHeight: 19 },
  dataCard: { gap: 12, padding: 14, backgroundColor: appColors.surface, borderRadius: 12, borderWidth: 1, borderColor: appColors.border },
  dataHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  labBadge: { fontSize: 11, color: appColors.primary, backgroundColor: appColors.primarySoft, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, overflow: 'hidden' },
  pendingResult: { color: appColors.warmInk, fontSize: 13 },
  emptyState: { alignItems: 'center', padding: 20, gap: 9, backgroundColor: appColors.canvas, borderRadius: 12 },
  doseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: appColors.canvas, borderRadius: 10 },
  doseCell: { flex: 1, minWidth: 74, gap: 5 },
  doseLabel: { color: appColors.muted, fontSize: 11 },
  doseValue: { color: appColors.ink, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  formCard: { gap: 10, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: appColors.border },
  cardTitle: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  listItem: { gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: appColors.border },
  itemTitle: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  value: { color: appColors.ink, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 44, borderWidth: 1, borderColor: appColors.border, borderRadius: 10, backgroundColor: appColors.surface, color: appColors.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  multiline: { minHeight: 94, textAlignVertical: 'top' },
  button: { minHeight: 46, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: appColors.primary, paddingHorizontal: 14 },
  buttonText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  addButton: { alignSelf: 'flex-start', paddingVertical: 8 },
  addText: { color: appColors.primary, fontWeight: '800' },
  remove: { color: '#A62F3D', fontSize: 13, fontWeight: '700' },
});
