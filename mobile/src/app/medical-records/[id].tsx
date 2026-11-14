import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { ClinicalRecordPanel } from '@/features/clinical/clinical-record-panel';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import {
  QuestionImageWorkflow,
  RecordImageLibrary,
} from '@/features/records/record-image-workflows';
import {
  medicalRecordsApi,
  type AnswerInput,
  type MedicalRecord,
  type MedicalRecordAnswer,
  type MedicalRecordSummary,
  type MedicalRecordTemplate,
  type MedicalRecordStatus,
  type TemplateQuestion,
} from '@/features/doctor/medical-records-api';
import { getDemoRole } from '@/features/navigation/feature-routes';

type QuestionDraft = {
  optionId?: number;
  values: string[];
  text: string;
};

const emptyDraft = (): QuestionDraft => ({ values: [], text: '' });

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? 'Ngày tạo không hợp lệ'
    : parsed.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function statusLabel(status: MedicalRecordStatus) {
  if (status === 'pending') return 'Chờ tiếp nhận';
  if (status === 'in_progress') return 'Đang khám';
  return 'Đã hoàn tất';
}

function parseAnswerValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') return [value];
  return [];
}

function answerDrafts(
  template: MedicalRecordTemplate,
  answers: MedicalRecordAnswer[],
): Record<string, QuestionDraft> {
  const result: Record<string, QuestionDraft> = {};
  for (const section of template.sections) {
    for (const question of section.questions) {
      const answer = answers.find((item) => item.question_id === question.question_id);
      if (!answer) continue;
      result[question.question_id] = {
        optionId: answer.question_option_id ?? undefined,
        values: parseAnswerValue(answer.answer_value),
        text: answer.answer_text ?? '',
      };
    }
  }
  return result;
}

function selectedValue(question: TemplateQuestion, draft?: QuestionDraft): string[] {
  if (!draft) return [];
  const option = question.options?.find((item) => item.id === draft.optionId);
  return [...draft.values, ...(option ? [option.option_value] : [])];
}

function isQuestionVisible(
  question: TemplateQuestion,
  questionsById: Map<string, TemplateQuestion>,
  drafts: Record<string, QuestionDraft>,
): boolean {
  if (!question.parent_question_id || !question.show_if_answer) return true;
  try {
    const conditions = JSON.parse(question.show_if_answer) as Record<string, string[]>;
    const allowed = conditions[question.parent_question_id];
    if (!Array.isArray(allowed)) return true;
    const parent = questionsById.get(question.parent_question_id);
    if (!parent) return true;
    const parentValues = selectedValue(parent, drafts[question.parent_question_id]);
    return parentValues.some((value) => allowed.includes(value));
  } catch {
    // An invalid display condition must not silently hide clinical questions.
    return true;
  }
}

export default function MedicalRecordDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const session = useAuthenticatedSession();
  const id = Number(rawId);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [summary, setSummary] = useState<MedicalRecordSummary | null>(null);
  const [answers, setAnswers] = useState<MedicalRecordAnswer[]>([]);
  const [template, setTemplate] = useState<MedicalRecordTemplate | null>(null);
  const [drafts, setDrafts] = useState<Record<string, QuestionDraft>>({});
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [answersLoading, setAnswersLoading] = useState(true);
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [savingAction, setSavingAction] = useState(false);
  const [imageRefreshToken, setImageRefreshToken] = useState(0);
  const [confirming, setConfirming] = useState<'accept' | 'complete' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [answersError, setAnswersError] = useState<string | null>(null);
  const [answersReadError, setAnswersReadError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (active: () => boolean) => {
    if (!session || !Number.isSafeInteger(id) || id < 1) {
      if (active()) { setError('Mã bệnh án không hợp lệ.'); setLoading(false); }
      return;
    }
    setLoading(true);
    setAnswersLoading(true);
    setError(null);
    setSummaryError(null);
    setAnswersError(null);
    setAnswersReadError(null);
    setTemplateError(null);
    setSuccess(null);
    setRecord(null);
    setSummary(null);
    setAnswers([]);
    setTemplate(null);
    setDrafts({});

    const [detailResult, summaryResult] = await Promise.allSettled([
      medicalRecordsApi.get(session, id),
      medicalRecordsApi.summary(session, id),
    ]);
    if (!active()) return;
    if (detailResult.status === 'rejected') {
      setError(detailResult.reason instanceof Error ? detailResult.reason.message : 'Không tải được bệnh án.');
      setLoading(false);
      setAnswersLoading(false);
      return;
    }
    const currentRecord = detailResult.value;
    setRecord(currentRecord);
    setInstructions(currentRecord.instructions ?? '');
    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value);
    } else {
      setSummary(null);
      setSummaryError(summaryResult.reason instanceof Error ? summaryResult.reason.message : 'Không tải được tóm tắt bệnh án.');
    }
    setLoading(false);

    const [answerResult, templateResult] = await Promise.allSettled([
      medicalRecordsApi.answers(session, id),
      medicalRecordsApi.template(session, currentRecord.template_id),
    ]);
    if (!active()) return;
    let currentAnswers: MedicalRecordAnswer[] = [];
    if (answerResult.status === 'fulfilled') {
      currentAnswers = answerResult.value;
      setAnswers(currentAnswers);
      setAnswersReadError(null);
    } else {
      setAnswers([]);
      setAnswersReadError(answerResult.reason instanceof Error ? answerResult.reason.message : 'Không tải được câu trả lời.');
    }
    if (templateResult.status === 'fulfilled') {
      setTemplate(templateResult.value);
      setDrafts(answerDrafts(templateResult.value, currentAnswers));
      setTemplateError(null);
    } else {
      setTemplate(null);
      setTemplateError(templateResult.reason instanceof Error ? templateResult.reason.message : 'Không tải được mẫu phiếu.');
    }
    setAnswersLoading(false);
  }, [session, id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const role = session ? getDemoRole(session.user.role_id) : null;
  const canAccept = role === 'doctor' && record?.status === 'pending' && record.assigned_doctor_id === null;
  const isAssignedDoctor = role === 'doctor' && record?.assigned_doctor_id === session?.user.user_id;
  const isPatientOwner = role === 'patient' && record?.patient_id === session?.user.user_id;
  const canComplete = !!isAssignedDoctor && record?.status === 'in_progress';
  const canDelete = role === 'admin';
  const canReadClinical = role === 'admin' || !!isAssignedDoctor || !!isPatientOwner;
  const canViewImages = canReadClinical;
  const canEditImages = record?.status !== 'completed' && (!!isAssignedDoctor || !!isPatientOwner);
  const canEditAnswers = record?.status !== 'completed'
    && !answersLoading
    && !answersReadError
    && (!!isAssignedDoctor || !!isPatientOwner);

  const questionsById = useMemo(() => {
    const map = new Map<string, TemplateQuestion>();
    for (const section of template?.sections ?? []) {
      for (const question of section.questions) map.set(question.question_id, question);
    }
    return map;
  }, [template]);

  function updateDraft(questionId: string, update: Partial<QuestionDraft>) {
    setDrafts((previous) => ({
      ...previous,
      [questionId]: { ...emptyDraft(), ...previous[questionId], ...update },
    }));
    setSuccess(null);
    setAnswersError(null);
  }

  function canFillSection(filledBy: 'patient' | 'doctor' | 'patdoc') {
    if (role === 'patient') return filledBy === 'patient' || filledBy === 'patdoc';
    if (role === 'doctor') return filledBy === 'doctor' || filledBy === 'patdoc';
    return false;
  }

  function answerPayload(): AnswerInput[] {
    if (!template || !record) return [];
    const payload: AnswerInput[] = [];
    for (const section of template.sections) {
      if (!canFillSection(section.filled_by)) continue;
      for (const question of section.questions) {
        if (!isQuestionVisible(question, questionsById, drafts)) continue;
        const draft = drafts[question.question_id] ?? emptyDraft();
        if (question.type_question === 'checkbox') {
          if (draft.values.length) payload.push({ question_id: question.question_id, answer_value: draft.values });
        } else if (['radio', 'select'].includes(question.type_question)) {
          if (draft.optionId !== undefined) {
            payload.push({ question_id: question.question_id, question_option_id: draft.optionId });
          }
        } else if (draft.text.trim()) {
          payload.push({ question_id: question.question_id, answer_text: draft.text.trim() });
        }
      }
    }
    return payload;
  }

  async function saveAnswers() {
    if (!session || !record || !canEditAnswers || savingAnswers || !template) return;
    const requiredMissing = template.sections
      .filter((section) => canFillSection(section.filled_by))
      .flatMap((section) => section.questions)
      .find((question) => question.is_required === 1
        && isQuestionVisible(question, questionsById, drafts)
        && !answerPayload().some((answer) => answer.question_id === question.question_id)
        && !(question.type_question === 'image'
          && answers.some((answer) => answer.question_id === question.question_id)));
    if (requiredMissing) {
      setAnswersError(requiredMissing.type_question === 'image'
        ? `Chưa thể lưu câu hỏi ảnh "${requiredMissing.question_text}": hợp đồng API chỉ gắn ảnh vào answer_id đã tồn tại và chưa quy định cách tạo câu trả lời ảnh. Hãy lưu câu trả lời trước nếu đã có trường trả lời hợp lệ; nếu không, cần làm rõ API.`
        : `Vui lòng trả lời: ${requiredMissing.question_text}`);
      return;
    }
    const payload = answerPayload();
    if (!payload.length) {
      setAnswersError('Chưa có câu trả lời để lưu.');
      return;
    }
    setSavingAnswers(true);
    setAnswersError(null);
    setSuccess(null);
    try {
      const result = await medicalRecordsApi.saveAnswers(session, record.medical_record_id, payload);
      setSuccess(`Đã lưu ${result.count} câu trả lời từ máy chủ.`);
      try {
        const updated = await medicalRecordsApi.answers(session, record.medical_record_id);
        setAnswers(updated);
        setDrafts(answerDrafts(template, updated));
      } catch (caught) {
        setAnswersReadError(
          `Máy chủ đã xác nhận lưu ${result.count} câu trả lời, nhưng không tải lại được dữ liệu: ${
            caught instanceof Error ? caught.message : 'Lỗi đọc dữ liệu.'
          }`,
        );
      }
    } catch (caught) {
      setAnswersError(caught instanceof Error ? caught.message : 'Không lưu được câu trả lời.');
    } finally {
      setSavingAnswers(false);
    }
  }

  async function runAction() {
    if (!session || !record || !confirming || savingAction) return;
    const action = confirming;
    setSavingAction(true);
    setError(null);
    setSuccess(null);
    try {
      if (action === 'accept') {
        await medicalRecordsApi.accept(session, record.medical_record_id);
        setConfirming(null);
        setSuccess('Máy chủ đã tiếp nhận bệnh án.');
        await load(() => true);
      } else if (action === 'complete') {
        await medicalRecordsApi.complete(session, record.medical_record_id, instructions);
        setConfirming(null);
        setSuccess('Máy chủ đã hoàn tất bệnh án.');
        await load(() => true);
      } else {
        await medicalRecordsApi.delete(session, record.medical_record_id);
        setConfirming(null);
        router.back();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể cập nhật bệnh án.');
    } finally {
      setSavingAction(false);
    }
  }

  function renderQuestion(question: TemplateQuestion) {
    const draft = drafts[question.question_id] ?? emptyDraft();
    if (!isQuestionVisible(question, questionsById, drafts)) return null;
    const editable = !!canEditAnswers && !!record && canFillSection(
      template?.sections.find((section) => section.questions.some((item) => item.question_id === question.question_id))?.filled_by ?? 'patdoc',
    );
    const isChoice = ['radio', 'select'].includes(question.type_question);
    const isCheckbox = question.type_question === 'checkbox';
    const isText = ['text', 'textarea', 'number', 'date'].includes(question.type_question);
    const isImage = question.type_question === 'image';
    const previousAnswer = answers.find((answer) => answer.question_id === question.question_id);
    const selectedOption = question.options?.find((option) => option.id === draft.optionId);
    const displayValue = selectedOption?.option_text
      ?? (draft.values.length ? draft.values.join(', ') : draft.text)
      ?? (previousAnswer?.answer_text ?? '');

    return (
      <View key={question.question_id} style={styles.question}>
        <Text style={styles.questionTitle}>
          {question.question_text}{question.is_required === 1 ? ' *' : ''}
        </Text>
        {question.help_text ? <Text style={styles.help}>{question.help_text}</Text> : null}
        {editable && (isChoice || isCheckbox) ? question.options?.map((option) => {
          const selected = isCheckbox
            ? draft.values.includes(option.option_value)
            : draft.optionId === option.id;
          return (
            <Pressable
              accessibilityRole={isCheckbox ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: selected, selected }}
              key={option.id}
              onPress={() => {
                if (isCheckbox) {
                  updateDraft(question.question_id, {
                    values: selected
                      ? draft.values.filter((value) => value !== option.option_value)
                      : [...draft.values, option.option_value],
                  });
                } else {
                  updateDraft(question.question_id, { optionId: option.id, values: [], text: '' });
                }
              }}
              style={[styles.answerOption, selected && styles.answerOptionSelected]}>
              <Text style={[styles.answerOptionText, selected && styles.answerOptionTextSelected]}>
                {selected ? '● ' : '○ '}{option.option_text}
              </Text>
            </Pressable>
          );
        }) : null}
        {editable && isText ? (
          <TextInput
            accessibilityLabel={question.question_text}
            keyboardType={question.type_question === 'number' ? 'decimal-pad' : 'default'}
            multiline={question.type_question === 'textarea'}
            onChangeText={(text) => updateDraft(question.question_id, { text, optionId: undefined, values: [] })}
            placeholder={question.placeholder ?? 'Nhập câu trả lời'}
            style={[styles.answerInput, question.type_question === 'textarea' && styles.multiline]}
            value={draft.text}
          />
        ) : null}
        {editable && !isChoice && !isCheckbox && !isText && !isImage ? (
          <Text style={styles.help}>Loại câu hỏi này cần luồng nhập riêng; chưa gửi dữ liệu không hợp lệ.</Text>
        ) : null}
        {!editable ? (
          <Text style={styles.answerReadOnly}>
            {displayValue || (previousAnswer?.answer_value ? JSON.stringify(previousAnswer.answer_value) : 'Chưa có câu trả lời được máy chủ trả về.')}
          </Text>
        ) : null}
        {record && (isImage || question.allow_image === 1 || selectedOption?.trigger_image_upload === 1) ? (
          <QuestionImageWorkflow
            answer={previousAnswer}
            canEdit={editable}
            onChanged={() => setImageRefreshToken((value) => value + 1)}
            optionValue={selectedOption?.trigger_image_upload === 1 ? selectedOption.option_value : undefined}
            question={question}
            recordId={record.medical_record_id}
            refreshToken={imageRefreshToken}
            session={session!}
          />
        ) : null}
      </View>
    );
  }

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>BỆNH ÁN / CHI TIẾT</Text>
        <Text style={styles.title}>Bệnh án #{rawId}</Text>
        {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.message}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void load(() => true)}>
              <Text style={styles.retry}>Tải lại</Text>
            </Pressable>
          </View>
        ) : null}
        {success ? <Text accessibilityLiveRegion="polite" style={styles.success}>{success}</Text> : null}

        {!loading && record ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>BỆNH NHÂN</Text>
              <Text style={styles.value}>{summary?.patient_name || `Bệnh nhân #${record.patient_id}`}</Text>
              {summaryError ? <Text style={styles.help}>Không tải được tóm tắt: {summaryError}</Text> : null}
              <Text style={styles.secondary}>Mã bệnh nhân: {record.patient_id}</Text>
              <View style={styles.divider} />
              <Text style={styles.label}>TRẠNG THÁI</Text>
              <Text style={styles.value}>{statusLabel(record.status)}</Text>
              <View style={styles.divider} />
              <Text style={styles.label}>MẪU PHIẾU</Text>
              <Text style={styles.value}>{template?.name ?? record.template_id}</Text>
              <Text style={styles.secondary}>Tạo lúc {dateLabel(record.created_at)}</Text>
              {record.completed_at ? <Text style={styles.secondary}>Hoàn tất lúc {dateLabel(record.completed_at)}</Text> : null}
              {record.instructions ? <Text style={styles.secondary}>Lời dặn: {record.instructions}</Text> : null}
            </View>

            {canViewImages ? (
              <RecordImageLibrary
                canDelete={role === 'admin' || role === 'doctor' || role === 'patient'}
                canUpload={!!canEditImages}
                onChanged={() => setImageRefreshToken((value) => value + 1)}
                patientId={record.patient_id}
                recordId={record.medical_record_id}
                refreshToken={imageRefreshToken}
                session={session}
              />
            ) : null}

            {canReadClinical ? (
              <ClinicalRecordPanel
                canWrite={!!isAssignedDoctor && record.status === 'in_progress'}
                recordId={record.medical_record_id}
                session={session}
              />
            ) : null}

            {isAssignedDoctor && record.status === 'in_progress' ? (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Theo dõi UAS7</Text>
                <Text style={styles.secondary}>
                  Chỉ mở dữ liệu bệnh nhân trong bệnh án đang được phân công; máy chủ sẽ xác nhận quyền truy cập.
                </Text>
                <ActionButton
                  label="Xem điểm UAS7"
                  onPress={() => router.push({
                    pathname: '/feature/[slug]',
                    params: { slug: 'uas7', patientId: String(record.patient_id) },
                  })}
                />
              </View>
            ) : null}

            {isPatientOwner || isAssignedDoctor || role === 'admin' ? (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Theo dõi tổn thương</Text>
                <Text style={styles.secondary}>
                  {isPatientOwner
                    ? 'Xem các ghi nhận gắn với bệnh án này.'
                    : 'Chỉ xem dữ liệu do máy chủ cho phép; không chỉnh sửa từ tài khoản nhân viên.'}
                </Text>
                <ActionButton
                  label="Mở đợt tổn thương"
                  onPress={() => router.push({
                    pathname: '/feature/[slug]',
                    params: { slug: 'lesion-tracking', medicalRecordId: String(record.medical_record_id) },
                  })}
                />
              </View>
            ) : null}

            {canAccept ? (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Tiếp nhận bệnh án</Text>
                <Text style={styles.secondary}>Bệnh án sẽ được gán cho bác sĩ đang đăng nhập nếu máy chủ xác nhận.</Text>
                {confirming === 'accept' ? (
                  <>
                    <Text style={styles.confirmText}>Xác nhận tiếp nhận bệnh án #{record.medical_record_id}?</Text>
                    <ActionButton label={savingAction ? 'Đang xử lý...' : 'Xác nhận tiếp nhận'} disabled={savingAction} onPress={() => void runAction()} />
                    <TextButton label="Hủy" onPress={() => setConfirming(null)} />
                  </>
                ) : <ActionButton label="Tiếp nhận" onPress={() => setConfirming('accept')} />}
              </View>
            ) : null}

            {canComplete ? (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Hoàn tất bệnh án</Text>
                <Text style={styles.secondary}>Chỉ bác sĩ được phân công mới có thể hoàn tất bệnh án đang khám.</Text>
                <TextInput
                  accessibilityLabel="Lời dặn hoặc kết luận của bác sĩ"
                  multiline
                  onChangeText={setInstructions}
                  placeholder="Lời dặn hoặc kết luận (không bắt buộc)"
                  style={[styles.answerInput, styles.multiline]}
                  value={instructions}
                />
                {confirming === 'complete' ? (
                  <>
                    <Text style={styles.confirmText}>Xác nhận chuyển bệnh án sang trạng thái đã hoàn tất?</Text>
                    <ActionButton label={savingAction ? 'Đang xử lý...' : 'Xác nhận hoàn tất'} disabled={savingAction} onPress={() => void runAction()} />
                    <TextButton label="Hủy" onPress={() => setConfirming(null)} />
                  </>
                ) : <ActionButton label="Hoàn tất bệnh án" onPress={() => setConfirming('complete')} />}
              </View>
            ) : null}

            {canDelete ? (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Xóa bệnh án</Text>
                <Text style={styles.secondary}>Thao tác này có thể xóa các dữ liệu liên quan theo quy tắc của máy chủ.</Text>
                {confirming === 'delete' ? (
                  <>
                    <Text style={styles.confirmText}>Xác nhận xóa bệnh án #{record.medical_record_id}? Chỉ xóa khi máy chủ trả thành công.</Text>
                    <ActionButton label={savingAction ? 'Đang xóa...' : 'Xác nhận xóa'} disabled={savingAction} destructive onPress={() => void runAction()} />
                    <TextButton label="Hủy" onPress={() => setConfirming(null)} />
                  </>
                ) : <ActionButton label="Xóa bệnh án" destructive onPress={() => setConfirming('delete')} />}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Câu trả lời</Text>
              <Text style={styles.secondary}>Dữ liệu hiển thị theo phản hồi của máy chủ và mẫu phiếu hiện hành.</Text>
            </View>
            {answersLoading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
                  {answersReadError ? (
              <View accessibilityLiveRegion="polite" style={styles.message}>
                      <Text style={styles.error}>{answersReadError}</Text>
                <Pressable accessibilityRole="button" onPress={() => void load(() => true)}>
                        <Text style={styles.retry}>Tải lại câu trả lời</Text>
                </Pressable>
              </View>
            ) : null}
                  {answersError ? <Text accessibilityLiveRegion="polite" style={styles.errorInline}>{answersError}</Text> : null}
            {templateError ? (
              <View style={styles.message}>
                <Text style={styles.error}>Không tải được mẫu phiếu/tóm tắt: {templateError}</Text>
                <Text style={styles.secondary}>Câu trả lời chưa được diễn giải theo nhãn câu hỏi; không có dữ liệu giả được hiển thị.</Text>
              </View>
            ) : null}
            {template ? template.sections.map((section) => (
              <View key={section.section_id} style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.help}>
                  {section.filled_by === 'patdoc' ? 'Bệnh nhân hoặc bác sĩ điền' : section.filled_by === 'patient' ? 'Bệnh nhân điền' : 'Bác sĩ điền'}
                </Text>
                {section.questions.map(renderQuestion)}
              </View>
            )) : null}
            {!answersLoading && !answersError && answers.length === 0 ? (
              <View style={styles.message}>
                <Text style={styles.secondary}>Máy chủ trả về chưa có câu trả lời cho bệnh án này.</Text>
              </View>
            ) : null}
            {canEditAnswers && template ? (
              <ActionButton
                label={savingAnswers ? 'Đang lưu...' : 'Lưu câu trả lời'}
                disabled={savingAnswers || answersLoading}
                onPress={() => void saveAnswers()}
              />
            ) : record.status === 'completed' ? (
              <Text style={styles.help}>Bệnh án đã hoàn tất và chỉ xem được.</Text>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  disabled,
  destructive,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, destructive && styles.destructiveButton, disabled && styles.disabled]}>
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.cancelButton}>
      <Text style={styles.cancelText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 30, paddingBottom: 42 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  loading: { marginTop: 25, marginBottom: 15 },
  card: { marginTop: 24, padding: 22, borderRadius: 20, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  label: { color: appColors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  value: { marginTop: 7, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  secondary: { marginTop: 7, color: appColors.muted, fontSize: 13, lineHeight: 20 },
  divider: { height: 1, backgroundColor: appColors.border, marginVertical: 18 },
  actionCard: { marginTop: 16, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  actionTitle: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  confirmText: { marginTop: 15, color: appColors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingHorizontal: 16, borderRadius: 14, backgroundColor: appColors.primary },
  destructiveButton: { backgroundColor: '#B42336' },
  primaryText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { color: appColors.primaryDark, fontSize: 14, fontWeight: '700' },
  sectionHeader: { marginTop: 30, marginBottom: 12 },
  sectionTitle: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  sectionCard: { marginTop: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  question: { marginTop: 18, gap: 9 },
  questionTitle: { color: appColors.ink, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  help: { marginTop: 6, color: appColors.muted, fontSize: 12, lineHeight: 18 },
  answerOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: appColors.border, borderRadius: 11 },
  answerOptionSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  answerOptionText: { color: appColors.ink, fontSize: 14 },
  answerOptionTextSelected: { color: appColors.primaryDark, fontWeight: '700' },
  answerInput: { minHeight: 48, borderWidth: 1, borderColor: appColors.border, borderRadius: 11, backgroundColor: appColors.surface, color: appColors.ink, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15 },
  multiline: { minHeight: 94, textAlignVertical: 'top' },
  answerReadOnly: { color: appColors.ink, fontSize: 14, lineHeight: 21 },
  message: { marginTop: 16, padding: 18, borderRadius: 16, backgroundColor: appColors.surface },
  error: { color: '#A62F3D', fontSize: 14, lineHeight: 20 },
  errorInline: { marginTop: 12, color: '#A62F3D', fontSize: 14, lineHeight: 20 },
  retry: { marginTop: 11, color: appColors.primary, fontSize: 14, fontWeight: '800' },
  success: { marginTop: 16, color: '#117447', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
});
