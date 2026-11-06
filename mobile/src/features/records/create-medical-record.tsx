import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
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

import { ApiRequestError } from '@/api/client';
import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import {
  medicalRecordsApi,
  type ClassificationQuestion,
} from '@/features/doctor/medical-records-api';
import { getDemoRole } from '@/features/navigation/feature-routes';

export function CreateMedicalRecord({ session }: { session: Session }) {
  const isDoctor = getDemoRole(session.user.role_id) === 'doctor';
  const [questions, setQuestions] = useState<ClassificationQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [patientId, setPatientId] = useState('');
  const [template, setTemplate] = useState<{ template_id: string; template_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQuestions = useCallback(async (active: () => boolean) => {
    setLoading(true);
    setError(null);
    try {
      const result = await medicalRecordsApi.getClassificationQuestions(session);
      if (active()) {
        setQuestions(result);
        setTemplate(null);
      }
    } catch (caught) {
      if (active()) setError(caught instanceof Error ? caught.message : 'Không tải được câu hỏi phân loại.');
    } finally {
      if (active()) setLoading(false);
    }
  }, [session]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadQuestions(() => active);
    return () => { active = false; };
  }, [loadQuestions]));

  function chooseAnswer(questionId: string, value: string) {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
    setTemplate(null);
    setError(null);
  }

  async function classify() {
    if (classifying) return;
    const missing = questions.find((question) => !answers[question.question_id]);
    if (missing) {
      setError(`Vui lòng trả lời: ${missing.question_text}`);
      return;
    }
    if (!questions.length) {
      setError('Máy chủ chưa cung cấp câu hỏi phân loại nên chưa thể tạo bệnh án.');
      return;
    }

    setClassifying(true);
    setError(null);
    try {
      const result = await medicalRecordsApi.classify(
        session,
        questions.map((question) => ({
          question_id: question.question_id,
          option_value: answers[question.question_id],
        })),
      );
      setTemplate(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không phân loại được bệnh án.');
    } finally {
      setClassifying(false);
    }
  }

  async function createRecord() {
    if (!template || creating) return;
    const patientValue = patientId.trim();
    const parsedPatientId = patientValue ? Number(patientValue) : undefined;
    if (isDoctor && (!parsedPatientId || !Number.isSafeInteger(parsedPatientId) || parsedPatientId < 1)) {
      setError('Bác sĩ cần nhập mã bệnh nhân hợp lệ.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const created = await medicalRecordsApi.create(session, {
        template_id: template.template_id,
        ...(isDoctor && parsedPatientId ? { patient_id: parsedPatientId } : {}),
      });
      if (!Number.isSafeInteger(created.medical_record_id) || created.medical_record_id < 1) {
        throw new ApiRequestError({
          kind: 'api',
          operation: 'POST /medical_records',
          apiCode: '1001',
          message: 'Máy chủ xác nhận đã tạo nhưng không trả về mã bệnh án hợp lệ.',
        });
      }
      router.replace({
        pathname: '/medical-records/[id]',
        params: { id: String(created.medical_record_id) },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tạo được bệnh án.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>BỆNH ÁN / TẠO MỚI</Text>
        <Text style={styles.title}>Tạo bệnh án</Text>
        <Text style={styles.subtitle}>
          Trả lời câu hỏi phân loại để máy chủ chọn mẫu phiếu phù hợp. Bệnh án chỉ được tạo sau khi API xác nhận.
        </Text>

        {isDoctor ? (
          <View style={styles.field}>
            <Text style={styles.label}>Mã bệnh nhân *</Text>
            <TextInput
              accessibilityLabel="Mã bệnh nhân"
              keyboardType="number-pad"
              onChangeText={(value) => { setPatientId(value); setTemplate(null); }}
              placeholder="Nhập mã bệnh nhân"
              style={styles.input}
              value={patientId}
            />
            <Text style={styles.hint}>Theo API, bác sĩ phải chỉ định bệnh nhân khi tạo bệnh án.</Text>
          </View>
        ) : null}

        {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
        {!loading && !error && questions.length === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Chưa có câu hỏi phân loại</Text>
            <Text style={styles.hint}>Máy chủ trả về danh sách rỗng; không thể chọn mẫu bệnh án.</Text>
          </View>
        ) : null}
        {!loading ? questions.map((question) => (
          <View key={question.question_id} style={styles.question}>
            <Text style={styles.label}>{question.question_text} *</Text>
            {question.options.map((option) => {
              const selected = answers[question.question_id] === option.option_value;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={option.id}
                  onPress={() => chooseAnswer(question.question_id, option.option_value)}
                  style={[styles.option, selected && styles.optionSelected]}>
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {selected ? '● ' : '○ '}{option.option_text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )) : null}

        {error ? (
          <View accessibilityLiveRegion="polite" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadQuestions(() => true)}>
              <Text style={styles.link}>Tải lại câu hỏi</Text>
            </Pressable>
          </View>
        ) : null}

        {template ? (
          <View style={styles.templateCard}>
            <Text style={styles.templateLabel}>MẪU PHIẾU ĐƯỢC ĐỀ XUẤT</Text>
            <Text style={styles.templateName}>{template.template_name}</Text>
            <Text style={styles.hint}>Mã mẫu: {template.template_id}</Text>
          </View>
        ) : null}

        {template ? (
          <Pressable
            accessibilityRole="button"
            disabled={creating}
            onPress={() => void createRecord()}
            style={[styles.primaryButton, creating && styles.disabled]}>
            <Text style={styles.primaryText}>{creating ? 'Đang tạo...' : 'Tạo bệnh án'}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={loading || classifying || questions.length === 0}
            onPress={() => void classify()}
            style={[styles.primaryButton, (loading || classifying || questions.length === 0) && styles.disabled]}>
            <Text style={styles.primaryText}>{classifying ? 'Đang phân loại...' : 'Phân loại bệnh án'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 44 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 8, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  field: { marginTop: 22, gap: 8 },
  label: { color: appColors.ink, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  input: { minHeight: 50, borderWidth: 1, borderColor: appColors.border, borderRadius: 13, backgroundColor: appColors.surface, color: appColors.ink, paddingHorizontal: 14, fontSize: 16 },
  hint: { marginTop: 5, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  question: { marginTop: 22, gap: 9, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  option: { minHeight: 46, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 11, borderWidth: 1, borderColor: appColors.border },
  optionSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  optionText: { color: appColors.ink, fontSize: 14 },
  optionTextSelected: { color: appColors.primaryDark, fontWeight: '700' },
  templateCard: { marginTop: 22, padding: 19, borderRadius: 16, backgroundColor: appColors.primarySoft },
  templateLabel: { color: appColors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  templateName: { marginTop: 8, color: appColors.ink, fontSize: 18, fontWeight: '800' },
  notice: { marginTop: 20, padding: 18, borderRadius: 16, backgroundColor: appColors.surface },
  noticeTitle: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  errorCard: { marginTop: 18, padding: 17, borderRadius: 15, backgroundColor: appColors.surface, borderWidth: 1, borderColor: '#F3C7CC' },
  errorText: { color: '#A62F3D', fontSize: 14, lineHeight: 20 },
  link: { marginTop: 12, color: appColors.primary, fontSize: 14, fontWeight: '800' },
  primaryButton: { minHeight: 52, justifyContent: 'center', alignItems: 'center', marginTop: 24, borderRadius: 14, backgroundColor: appColors.primary },
  primaryText: { color: appColors.surface, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  loading: { marginTop: 25 },
});
