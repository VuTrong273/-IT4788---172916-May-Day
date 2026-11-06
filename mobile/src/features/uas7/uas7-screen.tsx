import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { getDemoRole } from '@/features/navigation/feature-routes';
import {
  uas7Api,
  type Uas7Eligibility,
  type Uas7Score,
  type Uas7Week,
} from '@/features/uas7/uas7-api';
import {
  isValidUas7Date,
  validateUas7ScoreDraft,
  type Uas7ValidationErrors,
} from '@/features/uas7/uas7-validation';

const scoreOptions = ['0', '1', '2', '3'];

function todayAsDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function displayDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function ScoreSelector({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View accessibilityRole="radiogroup" style={styles.scoreOptions}>
        {scoreOptions.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={`${label}, ${option}`}
            accessibilityState={{ selected: value === option }}
            onPress={() => onChange(option)}
            style={[styles.scoreOption, value === option && styles.scoreOptionSelected]}>
            <Text style={[styles.scoreOptionText, value === option && styles.scoreOptionTextSelected]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={styles.errorPanel}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry}>
        <Text style={styles.retryText}>Thử lại</Text>
      </Pressable>
    </View>
  );
}

function RecordRow({ item }: { item: Uas7Score }) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyHeading}>
        <Text style={styles.historyDate}>{displayDate(item.score_date)}</Text>
        <Text style={styles.dailyScore}>Điểm ngày: {item.daily_score}</Text>
      </View>
      <Text style={styles.historyDetail}>Ngứa: {item.iss7}/3 · Số lượng mề đay: {item.hss7}/3</Text>
      {item.note ? <Text style={styles.historyNote}>{item.note}</Text> : null}
    </View>
  );
}

// Shared by the authenticated route and the role-filtered feature destination.
export function Uas7Screen() {
  const session = useAuthenticatedSession();
  const params = useLocalSearchParams<{
    patientId?: string | string[];
    patient_id?: string | string[];
  }>();
  const role = session ? getDemoRole(session.user.role_id) : null;
  const patient = role === 'patient';
  const routePatientId = params.patientId ?? params.patient_id;
  const rawPatientId = Array.isArray(routePatientId) ? routePatientId[0] : routePatientId;
  const patientId = patient
    ? session?.user.user_id
    : rawPatientId && /^\d+$/.test(rawPatientId) && Number.isSafeInteger(Number(rawPatientId))
      ? Number(rawPatientId)
      : undefined;
  const hasPatientContext = Number.isSafeInteger(patientId) && (patientId ?? 0) > 0;

  const [eligibility, setEligibility] = useState<Uas7Eligibility | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [scores, setScores] = useState<Uas7Score[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [week, setWeek] = useState<Uas7Week | null>(null);
  const [weekLoading, setWeekLoading] = useState(true);
  const [weekError, setWeekError] = useState<string | null>(null);
  const weekStartDateRef = useRef('');
  const [weekStartDate, setWeekStartDate] = useState('');
  const [weekDateError, setWeekDateError] = useState<string | null>(null);
  const [scoreDate, setScoreDate] = useState(todayAsDate);
  const [iss7, setIss7] = useState('');
  const [hss7, setHss7] = useState('');
  const [note, setNote] = useState('');
  const [validationErrors, setValidationErrors] = useState<Uas7ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdScore, setCreatedScore] = useState<Uas7Score | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (active: () => boolean) => {
    const requestedWeekStartDate = weekStartDateRef.current;
    setEligibilityError(null);
    setHistoryError(null);
    setWeekError(null);

    if (!session || !hasPatientContext || !patientId) {
      setEligibilityLoading(false);
      setHistoryLoading(false);
      setWeekLoading(false);
      setEligibility(null);
      setScores(null);
      setWeek(null);
      return;
    }

    if (!requestedWeekStartDate || isValidUas7Date(requestedWeekStartDate)) {
      setWeekDateError(null);
    } else {
      setWeekDateError('Nhập ngày bắt đầu tuần theo định dạng YYYY-MM-DD.');
      setWeekError(null);
    }

    setEligibilityLoading(patient);
    setHistoryLoading(true);
    setWeekLoading(true);
    const [eligibilityResult, historyResult, weekResult] = await Promise.allSettled([
      patient ? uas7Api.eligibility(session) : Promise.resolve(null),
      uas7Api.history(session, patientId),
      !requestedWeekStartDate || isValidUas7Date(requestedWeekStartDate)
        ? uas7Api.week(session, patientId, requestedWeekStartDate || undefined)
        : Promise.reject(new Error('Ngày bắt đầu tuần không hợp lệ.')),
    ]);

    if (!active()) return;

    if (patient) {
      if (eligibilityResult.status === 'fulfilled') {
        setEligibility(eligibilityResult.value);
      } else {
        setEligibility(null);
        setEligibilityError(errorMessage(eligibilityResult.reason, 'Không kiểm tra được điều kiện chấm UAS7.'));
      }
      setEligibilityLoading(false);
    }

    if (historyResult.status === 'fulfilled') {
      setScores(historyResult.value);
    } else {
      setScores(null);
      setHistoryError(errorMessage(historyResult.reason, 'Không tải được lịch sử UAS7.'));
    }
    setHistoryLoading(false);

    if (weekResult.status === 'fulfilled') {
      setWeek(weekResult.value);
      setWeekDateError(null);
    } else {
      setWeek(null);
      if (requestedWeekStartDate && !isValidUas7Date(requestedWeekStartDate)) {
        setWeekDateError('Nhập ngày bắt đầu tuần theo định dạng YYYY-MM-DD.');
        setWeekError(null);
      } else {
        setWeekError(errorMessage(weekResult.reason, 'Không tải được tổng điểm tuần.'));
      }
    }
    setWeekLoading(false);
  }, [hasPatientContext, patient, patientId, session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  async function submitScore() {
    if (!session || !patient || submitting || eligibility?.eligible !== 'true') return;
    const errors = validateUas7ScoreDraft({ scoreDate, iss7, hss7 });
    setValidationErrors(errors);
    setSubmitError(null);
    setCreatedScore(null);
    if (Object.keys(errors).length > 0) return;
    if (!eligibility.medical_record_id || !/^\d+$/.test(eligibility.medical_record_id)) {
      setSubmitError('Phản hồi điều kiện UAS7 không có mã bệnh án hợp lệ. Hãy tải lại trước khi gửi.');
      return;
    }

    setSubmitting(true);
    try {
      const saved = await uas7Api.create(session, {
        medical_record_id: eligibility.medical_record_id,
        score_date: scoreDate,
        iss7,
        hss7,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setCreatedScore(saved);
      setIss7('');
      setHss7('');
      setNote('');
      await load(() => true);
    } catch (error) {
      setSubmitError(errorMessage(error, 'Không lưu được điểm UAS7. Dữ liệu nhập vẫn được giữ lại.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  if (role !== 'patient' && role !== 'doctor' && role !== 'admin') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <Text style={styles.title}>Không thể mở UAS7</Text>
          <Text style={styles.bodyText}>Vai trò của tài khoản không có quyền truy cập chức năng này.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const eligibilityRecordId = eligibility?.medical_record_id;
  const hasEligibilityRecordId = !!eligibilityRecordId && /^\d+$/.test(eligibilityRecordId);
  const canSubmit = patient && eligibility?.eligible === 'true' && hasEligibilityRecordId;
  const readOnly = !patient;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>THEO DÕI / UAS7</Text>
        <Text style={styles.title}>Chấm điểm UAS7</Text>
        <Text style={styles.bodyText}>
          {patient
            ? 'Ghi nhận ngứa và số lượng mề đay theo ngày. Chỉ hiển thị kết quả do máy chủ trả về.'
            : `Lịch sử điểm của bệnh nhân #${patientId ?? '—'}. Quyền xem do máy chủ xác nhận.`}
        </Text>

        {!hasPatientContext ? (
          <View style={styles.infoPanel}>
            <Text style={styles.panelTitle}>Thiếu ngữ cảnh bệnh nhân</Text>
            <Text style={styles.mutedText}>
              Mở màn hình này từ hồ sơ bệnh nhân được phép xem. Không gửi yêu cầu tra cứu khi chưa có mã bệnh nhân.
            </Text>
          </View>
        ) : null}

        {patient ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Điều kiện ghi nhận</Text>
            {eligibilityLoading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
            {eligibilityError ? (
              <ErrorPanel message={eligibilityError} onRetry={() => void load(() => true)} />
            ) : null}
            {!eligibilityLoading && !eligibilityError && eligibility?.eligible === 'true' && hasEligibilityRecordId ? (
              <View style={styles.successPanel}>
                <Text style={styles.successTitle}>Đủ điều kiện chấm UAS7</Text>
                <Text style={styles.mutedText}>Bệnh án #{eligibilityRecordId}</Text>
              </View>
            ) : null}
            {!eligibilityLoading && !eligibilityError && eligibility?.eligible === 'true' && !hasEligibilityRecordId ? (
              <ErrorPanel
                message="Phản hồi đủ điều kiện không có mã bệnh án hợp lệ. Không thể gửi điểm; hãy tải lại để kiểm tra."
                onRetry={() => void load(() => true)}
              />
            ) : null}
            {!eligibilityLoading && !eligibilityError && eligibility?.eligible === 'false' ? (
              <View style={styles.infoPanel}>
                <Text style={styles.panelTitle}>Chưa thể ghi nhận</Text>
                <Text style={styles.mutedText}>
                  Dịch vụ xác nhận hiện chưa có bệnh án đang điều trị. Không thể gửi điểm UAS7 lúc này.
                </Text>
              </View>
            ) : null}
            {!eligibilityLoading && !eligibilityError && eligibility === null ? (
              <Text style={styles.mutedText}>Chưa nhận được kết quả điều kiện từ máy chủ.</Text>
            ) : null}
          </View>
        ) : null}

        {canSubmit ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ghi điểm trong ngày</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Ngày chấm</Text>
              <TextInput
                accessibilityLabel="Ngày chấm theo định dạng YYYY-MM-DD"
                autoCapitalize="none"
                onChangeText={(value) => {
                  setScoreDate(value);
                  setValidationErrors((current) => ({ ...current, scoreDate: undefined }));
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={appColors.muted}
                style={styles.textInput}
                value={scoreDate}
              />
              {validationErrors.scoreDate ? <Text style={styles.fieldError}>{validationErrors.scoreDate}</Text> : null}
              <ScoreSelector
                label="Mức độ ngứa (iss7)"
                value={iss7}
                onChange={(value) => {
                  setIss7(value);
                  setValidationErrors((current) => ({ ...current, iss7: undefined }));
                }}
                error={validationErrors.iss7}
              />
              <ScoreSelector
                label="Số lượng mề đay (hss7)"
                value={hss7}
                onChange={(value) => {
                  setHss7(value);
                  setValidationErrors((current) => ({ ...current, hss7: undefined }));
                }}
                error={validationErrors.hss7}
              />
              <Text style={styles.helperText}>Mỗi mục chọn một điểm từ 0 đến 3.</Text>
              <Text style={styles.helperText}>Tổng điểm ngày chỉ hiển thị sau khi máy chủ xác nhận.</Text>
              <Text style={[styles.fieldLabel, styles.noteLabel]}>Ghi chú (không bắt buộc)</Text>
              <TextInput
                accessibilityLabel="Ghi chú UAS7 không bắt buộc"
                multiline
                onChangeText={setNote}
                placeholder="Thêm ghi chú về triệu chứng"
                placeholderTextColor={appColors.muted}
                style={[styles.textInput, styles.noteInput]}
                value={note}
              />
              {submitError ? <Text accessibilityRole="alert" style={styles.errorText}>{submitError}</Text> : null}
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                onPress={() => void submitScore()}
                style={[styles.primaryButton, submitting && styles.disabledButton]}>
                {submitting ? <ActivityIndicator color={appColors.surface} /> : <Text style={styles.primaryButtonText}>Gửi điểm UAS7</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        {createdScore ? (
          <View accessibilityLiveRegion="polite" style={styles.successPanel}>
            <Text style={styles.successTitle}>Máy chủ đã ghi nhận điểm</Text>
            <Text style={styles.mutedText}>
              {displayDate(createdScore.score_date)} · Ngứa {createdScore.iss7}/3 · Mề đay {createdScore.hss7}/3 · Điểm ngày {createdScore.daily_score}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Tổng điểm tuần</Text>
            <Pressable accessibilityRole="button" onPress={() => void load(() => true)}>
              <Text style={styles.retryText}>Làm mới</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Ngày bắt đầu tuần (không bắt buộc)</Text>
            <TextInput
              accessibilityLabel="Ngày bắt đầu tuần theo định dạng YYYY-MM-DD"
              autoCapitalize="none"
              onChangeText={(value) => {
                weekStartDateRef.current = value;
                setWeekStartDate(value);
                setWeekDateError(null);
              }}
              placeholder="Để trống để dùng 7 ngày gần nhất"
              placeholderTextColor={appColors.muted}
              style={styles.textInput}
              value={weekStartDate}
            />
            {weekDateError ? <Text style={styles.fieldError}>{weekDateError}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => void load(() => true)}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Xem tuần</Text>
            </Pressable>
            {weekLoading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
            {weekError ? <ErrorPanel message={weekError} onRetry={() => void load(() => true)} /> : null}
            {!weekLoading && !weekError && week ? (
              <View style={styles.weekResult}>
                <Text style={styles.weekScore}>{week.week_score}</Text>
                <Text style={styles.weekScale}>/ 42</Text>
                <Text style={styles.severity}>{week.severity_label}</Text>
                <Text style={styles.mutedText}>Số ngày đã chấm: {week.completed_days}/7</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{readOnly ? 'Lịch sử bệnh nhân' : 'Lịch sử điểm UAS7'}</Text>
          {historyLoading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
          {historyError ? <ErrorPanel message={historyError} onRetry={() => void load(() => true)} /> : null}
          {!historyLoading && !historyError && scores?.length === 0 ? (
            <View style={styles.infoPanel}>
              <Text style={styles.panelTitle}>Chưa có điểm UAS7</Text>
              <Text style={styles.mutedText}>Máy chủ đã trả về lịch sử rỗng cho bệnh nhân này.</Text>
            </View>
          ) : null}
          {!historyLoading && !historyError && scores?.map((item) => (
            <RecordRow key={`${item.score_date}-${item.medical_record_id}`} item={item} />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default Uas7Screen;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 44 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  bodyText: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  section: { marginTop: 24 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  sectionTitle: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  card: { marginTop: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  field: { marginTop: 20 },
  fieldLabel: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  textInput: { minHeight: 48, marginTop: 8, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface, color: appColors.ink, fontSize: 15 },
  scoreOptions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  scoreOption: { width: 48, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.canvas },
  scoreOptionSelected: { borderColor: appColors.primary, backgroundColor: appColors.primary },
  scoreOptionText: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  scoreOptionTextSelected: { color: appColors.surface },
  helperText: { marginTop: 10, color: appColors.muted, fontSize: 12 },
  noteLabel: { marginTop: 20 },
  noteInput: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' },
  fieldError: { marginTop: 6, color: '#B42336', fontSize: 12 },
  errorText: { marginTop: 12, color: '#B42336', fontSize: 14, lineHeight: 20 },
  errorPanel: { marginTop: 12, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#F3B7BF', backgroundColor: '#FFF5F6' },
  retryText: { marginTop: 8, color: appColors.primary, fontSize: 14, fontWeight: '800' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderRadius: 14, backgroundColor: appColors.primary },
  primaryButtonText: { color: appColors.surface, fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: appColors.primary, backgroundColor: appColors.surface },
  secondaryButtonText: { color: appColors.primary, fontSize: 14, fontWeight: '800' },
  loading: { marginVertical: 16 },
  successPanel: { marginTop: 15, padding: 17, borderRadius: 15, borderWidth: 1, borderColor: '#A8D9C3', backgroundColor: '#F0FBF6' },
  successTitle: { color: '#186A48', fontSize: 15, fontWeight: '800' },
  mutedText: { marginTop: 7, color: appColors.muted, fontSize: 13, lineHeight: 20 },
  infoPanel: { marginTop: 12, padding: 17, borderRadius: 15, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  panelTitle: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  weekResult: { alignItems: 'center', paddingTop: 18 },
  weekScore: { color: appColors.primary, fontSize: 38, fontWeight: '900' },
  weekScale: { color: appColors.muted, fontSize: 13 },
  severity: { marginTop: 10, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  historyRow: { marginTop: 10, padding: 16, borderRadius: 15, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  historyHeading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  historyDate: { color: appColors.ink, fontSize: 14, fontWeight: '800' },
  dailyScore: { color: appColors.primary, fontSize: 14, fontWeight: '800' },
  historyDetail: { marginTop: 9, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  historyNote: { marginTop: 8, color: appColors.ink, fontSize: 13, lineHeight: 19 },
});
