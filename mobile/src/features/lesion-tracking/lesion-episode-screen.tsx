import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import type { PatientHistoryItem } from '@/features/doctor/medical-records-api';
import { medicalRecordsApi } from '@/features/doctor/medical-records-api';
import { getDemoRole } from '@/features/navigation/feature-routes';
import {
  lesionEpisodesApi,
  sortLesionEpisodesChronologically,
  validateLesionEpisodeInput,
  type LesionEpisode,
  type LesionEpisodeInput,
  type LesionEpisodeUpdate,
} from '@/features/lesion-tracking/lesion-episodes-api';

const dangerColor = '#B42318';
const successColor = '#147D64';

type Props = {
  medicalRecordId?: string;
  recordLinkedReadOnly?: boolean;
};

type EpisodeDraft = {
  medicalRecordId: string;
  name: string;
  occurredAt: string;
  contextTags: string;
  contextOther: string;
  medicationName: string;
  medicationTakenAgo: string;
  medicationUnit: 'minute' | 'hour' | 'day' | '';
  description: string;
};

const emptyDraft = (medicalRecordId = ''): EpisodeDraft => ({
  medicalRecordId,
  name: '',
  occurredAt: '',
  contextTags: '',
  contextOther: '',
  medicationName: '',
  medicationTakenAgo: '',
  medicationUnit: '',
  description: '',
});

function isoInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function serializeDraft(draft: EpisodeDraft): LesionEpisodeInput {
  const tags = draft.contextTags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const occurredAt = draft.occurredAt ? new Date(draft.occurredAt) : null;
  return {
    medical_record_id: draft.medicalRecordId,
    name: draft.name.trim(),
    occurred_at: occurredAt
      ? Number.isNaN(occurredAt.getTime()) ? draft.occurredAt : occurredAt.toISOString()
      : null,
    context_tags: tags.length ? JSON.stringify(tags) : null,
    context_other: draft.contextOther.trim() || null,
    medication_name: draft.medicationName.trim() || null,
    medication_taken_ago: draft.medicationTakenAgo.trim() || null,
    medication_unit: draft.medicationUnit || null,
    description: draft.description.trim() || null,
  };
}

function draftFromEpisode(episode: LesionEpisode): EpisodeDraft {
  let contextTags = episode.context_tags ?? '';
  if (contextTags) {
    try {
      const parsed: unknown = JSON.parse(contextTags);
      if (Array.isArray(parsed) && parsed.every((tag) => typeof tag === 'string')) {
        contextTags = parsed.join(', ');
      }
    } catch {
      // Keep the exact server value visible if the stored JSON string is malformed.
    }
  }
  return {
    medicalRecordId: episode.medical_record_id,
    name: episode.name,
    occurredAt: isoInput(episode.occurred_at),
    contextTags,
    contextOther: episode.context_other ?? '',
    medicationName: episode.medication_name ?? '',
    medicationTakenAgo: episode.medication_taken_ago ?? '',
    medicationUnit: episode.medication_unit ?? '',
    description: episode.description ?? '',
  };
}

function dateLabel(value: string | null): string {
  if (!value) return 'Chưa ghi nhận thời điểm';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Thời điểm do máy chủ trả về không hợp lệ'
    : date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function displayTags(value: string | null): string {
  if (!value) return 'Chưa ghi nhận';
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((tag) => typeof tag === 'string')) {
      return parsed.join(', ') || 'Chưa ghi nhận';
    }
  } catch {
    // Keep an unrecognized service value visible instead of hiding it.
  }
  return value;
}

export function LesionEpisodeScreen({ medicalRecordId, recordLinkedReadOnly = false }: Props) {
  const session = useAuthenticatedSession();
  const role = session ? getDemoRole(session.user.role_id) : null;
  const patientView = role === 'patient' && !recordLinkedReadOnly;
  const recordIdIsValid = !!medicalRecordId && /^\d+$/.test(medicalRecordId);
  const [records, setRecords] = useState<PatientHistoryItem[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState(medicalRecordId ?? '');
  const [episodes, setEpisodes] = useState<LesionEpisode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<LesionEpisode | null>(null);
  const [draft, setDraft] = useState<EpisodeDraft>(() => emptyDraft(medicalRecordId ?? ''));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (active: () => boolean) => {
    if (!session) return;
    if (recordLinkedReadOnly && (!recordIdIsValid || (role !== 'doctor' && role !== 'admin'))) {
      setError('Bệnh án hoặc quyền truy cập không hợp lệ.');
      return;
    }
    setLoading(true);
    setError(null);
    setHistoryError(null);
    setSuccess(null);
    const episodeRequest = patientView
      ? lesionEpisodesApi.listMine(session, selectedRecordId || undefined)
      : lesionEpisodesApi.listByRecord(session, medicalRecordId ?? '');
    const historyRequest = patientView
      ? medicalRecordsApi.history(session, session.user.user_id)
      : Promise.resolve([] as PatientHistoryItem[]);
    if (patientView) setHistoryLoading(true);

    const [episodeResult, historyResult] = await Promise.allSettled([
      episodeRequest,
      historyRequest,
    ]);
    if (!active()) return;
    if (episodeResult.status === 'fulfilled') {
      setEpisodes(sortLesionEpisodesChronologically(episodeResult.value));
      setError(null);
    } else {
      setEpisodes([]);
      setError(episodeResult.reason instanceof Error
        ? episodeResult.reason.message
        : 'Không tải được các đợt tổn thương từ máy chủ.');
    }
    if (patientView) {
      if (historyResult.status === 'fulfilled') {
        setRecords(historyResult.value);
        setHistoryError(null);
      } else {
        setRecords([]);
        setHistoryError(historyResult.reason instanceof Error
          ? historyResult.reason.message
          : 'Không tải được danh sách bệnh án.');
      }
      setHistoryLoading(false);
    }
    setLoading(false);
  }, [session, role, recordLinkedReadOnly, recordIdIsValid, patientView, selectedRecordId, medicalRecordId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const editableRecordIds = useMemo(
    () => new Set(records.filter((record) => record.status === 'pending' || record.status === 'in_progress')
      .map((record) => String(record.medical_record_id))),
    [records],
  );
  const selectedRecordIsEditable = editableRecordIds.has(draft.medicalRecordId);

  function updateDraft<K extends keyof EpisodeDraft>(key: K, value: EpisodeDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function beginEdit() {
    if (!selectedEpisode || !patientView) return;
    setDraft(draftFromEpisode(selectedEpisode));
    setEditing(true);
    setFormError(null);
    setSuccess(null);
  }

  async function openDetails(episode: LesionEpisode) {
    if (!session) return;
    setDetailError(null);
    setSelectedEpisode(null);
    try {
      const detail = await lesionEpisodesApi.get(session, episode.episode_id);
      setSelectedEpisode(detail);
    } catch (requestError) {
      setDetailError(requestError instanceof Error
        ? requestError.message
        : 'Không tải được chi tiết đợt tổn thương.');
    }
  }

  async function submitCreate() {
    if (!session) return;
    const input = serializeDraft(draft);
    const invalid = validateLesionEpisodeInput(input);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    if (!selectedRecordIsEditable) {
      setFormError('Chỉ có thể ghi nhận vào bệnh án đang chờ hoặc đang khám do máy chủ trả về.');
      return;
    }
    setSaving(true);
    setFormError(null);
    setSuccess(null);
    try {
      const created = await lesionEpisodesApi.create(session, input);
      setEpisodes((current) => sortLesionEpisodesChronologically([...current, created]));
      setCreating(false);
      setDraft(emptyDraft(selectedRecordId));
      setSuccess('Máy chủ đã xác nhận ghi nhận đợt tổn thương.');
    } catch (requestError) {
      setFormError(requestError instanceof Error
        ? requestError.message
        : 'Không thể lưu đợt tổn thương. Bản nháp vẫn được giữ lại.');
    } finally {
      setSaving(false);
    }
  }

  async function submitUpdate() {
    if (!session || !selectedEpisode) return;
    const input = serializeDraft({ ...draft, medicalRecordId: selectedEpisode.medical_record_id });
    const invalid = validateLesionEpisodeInput(input);
    if (invalid) {
      setFormError(invalid);
      return;
    }
    const update: LesionEpisodeUpdate = {
      name: input.name,
      occurred_at: input.occurred_at,
      context_tags: input.context_tags,
      context_other: input.context_other,
      medication_name: input.medication_name,
      medication_taken_ago: input.medication_taken_ago,
      medication_unit: input.medication_unit,
      description: input.description,
    };
    setSaving(true);
    setFormError(null);
    setSuccess(null);
    try {
      const updated = await lesionEpisodesApi.update(session, selectedEpisode.episode_id, update);
      setSelectedEpisode(updated);
      setEpisodes((current) => sortLesionEpisodesChronologically(
        current.map((episode) => episode.episode_id === updated.episode_id ? updated : episode),
      ));
      setDraft(draftFromEpisode(updated));
      setEditing(false);
      setSuccess('Máy chủ đã xác nhận cập nhật đợt tổn thương.');
    } catch (requestError) {
      setFormError(requestError instanceof Error
        ? requestError.message
        : 'Không thể cập nhật. Bản nháp vẫn được giữ lại.');
    } finally {
      setSaving(false);
    }
  }

  async function submitDelete() {
    if (!session || !selectedEpisode) return;
    setSaving(true);
    setFormError(null);
    setSuccess(null);
    try {
      await lesionEpisodesApi.remove(session, selectedEpisode.episode_id);
      setEpisodes((current) => current.filter((episode) => episode.episode_id !== selectedEpisode.episode_id));
      setSelectedEpisode(null);
      setEditing(false);
      setConfirmingDelete(false);
      setSuccess('Máy chủ đã xác nhận xóa đợt tổn thương.');
    } catch (requestError) {
      setFormError(requestError instanceof Error
        ? requestError.message
        : 'Không thể xóa đợt tổn thương.');
    } finally {
      setSaving(false);
    }
  }

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  if (!patientView && role !== 'doctor' && role !== 'admin') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Không thể mở trang theo dõi</Text>
          <Text style={styles.body}>Tài khoản này không có luồng theo dõi tổn thương được cấp.</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!patientView && !recordLinkedReadOnly) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Cần mở từ bệnh án</Text>
          <Text style={styles.body}>Bác sĩ và quản trị viên chỉ xem được tổn thương theo bệnh án được máy chủ cho phép.</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (recordLinkedReadOnly && !recordIdIsValid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Mã bệnh án không hợp lệ</Text>
        </View>
      </SafeAreaView>
    );
  }

  const recordsForFilter = records;
  const canCreate = patientView && selectedRecordIsEditable;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MAY DAY / THEO DÕI</Text>
        <Text style={styles.title}>Đợt tổn thương</Text>
        <Text style={styles.body}>
          {patientView
            ? 'Ghi nhận và xem lại các đợt theo dõi được lưu từ tài khoản của bạn.'
            : `Các đợt tổn thương gắn với bệnh án #${medicalRecordId}; dữ liệu chỉ đọc.`}
        </Text>

        {patientView ? (
          <View style={styles.card}>
            <Text style={styles.label}>BỆNH ÁN</Text>
            <Text style={styles.body}>Chọn bệnh án để lọc, hoặc để trống để dùng danh sách do máy chủ trả về.</Text>
            {historyLoading ? <ActivityIndicator color={appColors.primary} style={styles.spinner} /> : null}
            {historyError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{historyError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setSelectedRecordId('');
                setSelectedEpisode(null);
                if (creating) updateDraft('medicalRecordId', '');
              }}
              style={[styles.choice, !selectedRecordId && styles.choiceSelected]}>
              <Text style={[styles.choiceText, !selectedRecordId && styles.choiceTextSelected]}>Tất cả theo mặc định của máy chủ</Text>
            </Pressable>
            {recordsForFilter.map((record) => {
              const value = String(record.medical_record_id);
              const selected = value === selectedRecordId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={value}
                  onPress={() => {
                    setSelectedRecordId(value);
                    setSelectedEpisode(null);
                    if (creating) updateDraft('medicalRecordId', value);
                  }}
                  style={[styles.choice, selected && styles.choiceSelected]}>
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    Bệnh án #{value} · {record.status === 'pending' ? 'Chờ khám' : record.status === 'in_progress' ? 'Đang khám' : 'Đã hoàn tất'}
                  </Text>
                </Pressable>
              );
            })}
            {!historyLoading && !historyError && records.length === 0 ? (
              <Text style={styles.muted}>Máy chủ chưa trả về bệnh án nào để chọn.</Text>
            ) : null}
          </View>
        ) : null}

        {patientView ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ghi nhận đợt mới</Text>
            <Text style={styles.body}>Yêu cầu ghi nhận chỉ được xác nhận sau khi máy chủ trả thành công.</Text>
            {!creating ? (
              <ActionButton
                label="Tạo ghi nhận"
                disabled={!canCreate}
                onPress={() => { setCreating(true); setDraft(emptyDraft(selectedRecordId)); setFormError(null); }}
              />
            ) : (
              <EpisodeForm
                draft={draft}
                error={formError}
                saving={saving}
                submitLabel="Lưu đợt tổn thương"
                onChange={updateDraft}
                onCancel={() => { setCreating(false); setFormError(null); }}
                onSubmit={() => void submitCreate()}
              />
            )}
            {!canCreate ? (
              <Text style={styles.muted}>Chọn bệnh án ở trạng thái chờ khám hoặc đang khám từ danh sách trả về để ghi nhận.</Text>
            ) : null}
          </View>
        ) : null}

        {success ? <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text> : null}
        {loading ? <ActivityIndicator color={appColors.primary} style={styles.spinner} /> : null}
        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.message}>
            <Text style={styles.error}>{error}</Text>
            <ActionButton label="Tải lại từ máy chủ" onPress={() => void load(() => true)} />
          </View>
        ) : null}
        {!loading && !error && episodes.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Chưa có đợt tổn thương</Text>
            <Text style={styles.body}>Danh sách trống theo phản hồi hiện tại của máy chủ.</Text>
          </View>
        ) : null}
        {episodes.map((episode) => (
          <View key={episode.episode_id} style={styles.episodeCard}>
            <Text style={styles.episodeTitle}>{episode.name}</Text>
            <Text style={styles.label}>{dateLabel(episode.occurred_at)}</Text>
            <Text style={styles.muted}>Bệnh án #{episode.medical_record_id}</Text>
            <ActionButton label="Xem chi tiết từ máy chủ" onPress={() => void openDetails(episode)} />
          </View>
        ))}

        {detailError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{detailError}</Text> : null}
        {selectedEpisode ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{selectedEpisode.name}</Text>
            <Text style={styles.label}>THỜI ĐIỂM</Text>
            <Text style={styles.body}>{dateLabel(selectedEpisode.occurred_at)}</Text>
            <Text style={styles.label}>BỐI CẢNH</Text>
            <Text style={styles.body}>{displayTags(selectedEpisode.context_tags)}</Text>
            <Text style={styles.body}>{selectedEpisode.context_other || 'Không có bối cảnh khác được ghi nhận.'}</Text>
            <Text style={styles.label}>THUỐC ĐÃ DÙNG</Text>
            <Text style={styles.body}>
              {[selectedEpisode.medication_name, selectedEpisode.medication_taken_ago, selectedEpisode.medication_unit]
                .filter(Boolean).join(' · ') || 'Không có thuốc được ghi nhận.'}
            </Text>
            <Text style={styles.label}>MÔ TẢ</Text>
            <Text style={styles.body}>{selectedEpisode.description || 'Không có mô tả được ghi nhận.'}</Text>
            {patientView && !editing ? (
              <>
                <ActionButton label="Chỉnh sửa" onPress={beginEdit} />
                {confirmingDelete ? (
                  <View style={styles.confirmBox}>
                    <Text style={styles.error}>Xóa đợt này cùng các vị trí và ảnh liên quan theo quy tắc máy chủ?</Text>
                    <ActionButton label={saving ? 'Đang xóa…' : 'Xác nhận xóa'} disabled={saving} destructive onPress={() => void submitDelete()} />
                    <TextButton label="Hủy" onPress={() => setConfirmingDelete(false)} />
                  </View>
                ) : <ActionButton label="Xóa" destructive onPress={() => setConfirmingDelete(true)} />}
              </>
            ) : null}
            {patientView && editing ? (
              <EpisodeForm
                draft={draft}
                error={formError}
                saving={saving}
                submitLabel="Lưu thay đổi"
                onChange={updateDraft}
                onCancel={() => { setEditing(false); setFormError(null); }}
                onSubmit={() => void submitUpdate()}
              />
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EpisodeForm({
  draft,
  error,
  saving,
  submitLabel,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: EpisodeDraft;
  error: string | null;
  saving: boolean;
  submitLabel: string;
  onChange: <K extends keyof EpisodeDraft>(key: K, value: EpisodeDraft[K]) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const input = (
    label: string,
    key: keyof EpisodeDraft,
    options: { multiline?: boolean; keyboardType?: 'default' | 'numeric' } = {},
  ) => (
    <View style={styles.field} key={key}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={options.keyboardType ?? 'default'}
        multiline={options.multiline}
        onChangeText={(text) => onChange(key, text as EpisodeDraft[typeof key])}
        style={[styles.input, options.multiline && styles.multiline]}
        value={draft[key] as string}
      />
    </View>
  );

  return (
    <View style={styles.form}>
      {input('Tên đợt tổn thương *', 'name')}
      {input('Thời điểm xuất hiện (YYYY-MM-DDTHH:mm)', 'occurredAt')}
      {input('Thẻ bối cảnh, phân cách bằng dấu phẩy', 'contextTags')}
      {input('Bối cảnh khác', 'contextOther', { multiline: true })}
      {input('Tên thuốc đã dùng', 'medicationName')}
      {input('Đã dùng thuốc cách đây (số)', 'medicationTakenAgo', { keyboardType: 'numeric' })}
      <Text style={styles.fieldLabel}>Đơn vị thời gian dùng thuốc</Text>
      <View style={styles.inlineChoices}>
        {(['', 'minute', 'hour', 'day'] as const).map((unit) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: draft.medicationUnit === unit }}
            key={unit || 'none'}
            onPress={() => onChange('medicationUnit', unit)}
            style={[styles.choice, styles.unitChoice, draft.medicationUnit === unit && styles.choiceSelected]}>
            <Text style={[styles.choiceText, draft.medicationUnit === unit && styles.choiceTextSelected]}>
              {unit || 'Không chọn'}
            </Text>
          </Pressable>
        ))}
      </View>
      {input('Mô tả', 'description', { multiline: true })}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <ActionButton label={saving ? 'Đang lưu…' : submitLabel} disabled={saving} onPress={onSubmit} />
      <TextButton label="Hủy" onPress={onCancel} />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  disabled = false,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        destructive && styles.destructiveButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.textButton}>
      <Text style={styles.textButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 850, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 44 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  sectionTitle: { color: appColors.ink, fontSize: 19, fontWeight: '800' },
  body: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 22 },
  muted: { marginTop: 8, color: appColors.muted, fontSize: 13, lineHeight: 20 },
  card: { marginTop: 18, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  episodeCard: { marginTop: 14, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  episodeTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  label: { marginTop: 14, color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  spinner: { marginVertical: 18 },
  choice: { alignSelf: 'flex-start', marginTop: 9, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, backgroundColor: appColors.surface },
  choiceSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  choiceText: { color: appColors.ink, fontSize: 13, fontWeight: '600' },
  choiceTextSelected: { color: appColors.primary, fontWeight: '800' },
  form: { marginTop: 14 },
  field: { marginTop: 12 },
  fieldLabel: { color: appColors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, marginTop: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: appColors.border, borderRadius: 11, backgroundColor: appColors.canvas, color: appColors.ink, fontSize: 14 },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  inlineChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  unitChoice: { marginTop: 8, paddingHorizontal: 10, paddingVertical: 8 },
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 13, paddingHorizontal: 16, borderRadius: 12, backgroundColor: appColors.primary },
  destructiveButton: { backgroundColor: dangerColor },
  disabledButton: { opacity: 0.5 },
  pressed: { opacity: 0.78 },
  buttonText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  textButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', paddingHorizontal: 10 },
  textButtonLabel: { color: appColors.muted, fontSize: 14, fontWeight: '700' },
  error: { marginTop: 10, color: dangerColor, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  success: { marginTop: 15, color: successColor, fontSize: 14, fontWeight: '700' },
  message: { marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: dangerColor, backgroundColor: appColors.surface },
  confirmBox: { marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: appColors.border },
});
