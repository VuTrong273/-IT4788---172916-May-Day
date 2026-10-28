import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { LesionTimeline } from "@/features/tracking/lesion-timeline";
import { PatientUas7 } from "@/features/doctor/patient-uas7";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { appColors } from "@/constants/app-theme";
import { useAuthenticatedSession } from "@/features/auth/use-authenticated-session";
import { getDemoRole } from "@/features/navigation/feature-routes";
import {
  MedicalRecordQuestionnaire,
  type AnswerDraft,
  type QuestionnaireSection,
} from "@/features/patient/medical-record-questionnaire";
import { patientRecordsApi } from "@/features/patient/patient-records-api";
import {
  medicalRecordsApi,
  type MedicalRecord,
  type MedicalRecordSummary,
} from "@/features/doctor/medical-records-api";

function dateLabel(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function hasValue(answer: AnswerDraft) {
  return (
    Boolean(answer.answer_text?.trim()) ||
    answer.question_option_id !== null ||
    (Array.isArray(answer.answer_value) && answer.answer_value.length > 0) ||
    (typeof answer.answer_value === "string" && answer.answer_value.length > 0)
  );
}

export default function MedicalRecordDetailScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const session = useAuthenticatedSession();
  const id = Number(rawId);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [summary, setSummary] = useState<MedicalRecordSummary | null>(null);
  const [sections, setSections] = useState<QuestionnaireSection[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(
    async (active: () => boolean) => {
      if (!session || !Number.isSafeInteger(id) || id < 1) {
        if (active()) {
          setError("Mã lần khám không hợp lệ.");
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [detail, brief, savedAnswers] = await Promise.all([
          medicalRecordsApi.get(session, id),
          medicalRecordsApi.summary(session, id),
          patientRecordsApi.answers(session, id),
        ]);
        const template = await patientRecordsApi.template(
          session,
          detail.template_id,
        );
        if (!active()) return;
        setRecord(detail);
        setSummary(brief);
        setSections(template.sections);
        setInstructions(detail.instructions ?? "");
        setAnswers(
          Object.fromEntries(
            savedAnswers.map((answer) => [answer.question_id, answer]),
          ),
        );
      } catch (caught) {
        if (active())
          setError(
            caught instanceof Error
              ? caught.message
              : "Không tải được lần khám.",
          );
      } finally {
        if (active()) setLoading(false);
      }
    },
    [session, id],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void load(() => active);
      return () => {
        active = false;
      };
    }, [load]),
  );

  async function accept() {
    if (!session || !record || saving) return;
    setSaving(true);
    setError(null);
    try {
      await medicalRecordsApi.accept(session, record.medical_record_id);
      setConfirming(false);
      await load(() => true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không tiếp nhận được lần khám.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAnswers() {
    if (!session || !record || saving) return;
    const editableQuestionIds = new Set(
      sections
        .filter(
          (section) =>
            section.filled_by === role || section.filled_by === "patdoc",
        )
        .flatMap((section) =>
          section.questions.map((question) => question.question_id),
        ),
    );
    const filledAnswers = Object.values(answers).filter(
      (answer) =>
        editableQuestionIds.has(answer.question_id) && hasValue(answer),
    );
    if (filledAnswers.length === 0) {
      setError("Hãy nhập ít nhất một câu trả lời trước khi lưu.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await patientRecordsApi.saveAnswers(
        session,
        record.medical_record_id,
        filledAnswers,
      );
      setSuccess("Đã lưu câu trả lời.");
      await load(() => true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không lưu được câu trả lời.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    if (!session || !record || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await medicalRecordsApi.complete(
        session,
        record.medical_record_id,
        instructions.trim(),
      );
      setConfirming(false);
      setSuccess("Đã hoàn tất lần khám.");
      await load(() => true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không thể hoàn tất lần khám.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!session) return <SafeAreaView style={styles.safeArea} />;
  const role = getDemoRole(session.user.role_id);
  const isDoctor = role === "doctor";
  const canAccept =
    isDoctor &&
    record?.status === "pending" &&
    record.assigned_doctor_id === null;
  const canEdit =
    record?.status !== "completed" &&
    ((role === "patient" && record?.patient_id === session.user.user_id) ||
      (isDoctor &&
        record?.status === "in_progress" &&
        record.assigned_doctor_id === session.user.user_id));
  const canComplete =
    isDoctor &&
    record?.status === "in_progress" &&
    record.assigned_doctor_id === session.user.user_id;

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>BỆNH ÁN / CHI TIẾT</Text>
        <Text style={styles.title}>Lần khám #{rawId}</Text>
        {loading ? (
          <ActivityIndicator color={appColors.primary} style={styles.loading} />
        ) : null}
        {error ? (
          <View style={styles.message}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load(() => true)}>
              <Text style={styles.retry}>Tải lại</Text>
            </Pressable>
          </View>
        ) : null}
        {success ? (
          <View style={styles.successCard}>
            <Text style={styles.success}>{success}</Text>
          </View>
        ) : null}
        {!loading && record ? (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>BỆNH NHÂN</Text>
              <Text style={styles.value}>
                {summary?.patient_name || `Bệnh nhân #${record.patient_id}`}
              </Text>
              <Text style={styles.secondary}>
                Mã bệnh nhân: {record.patient_id}
              </Text>
              <View style={styles.divider} />
              <Text style={styles.label}>TRẠNG THÁI</Text>
              <Text style={styles.value}>
                {record.status === "pending"
                  ? "Chờ tiếp nhận"
                  : record.status === "in_progress"
                    ? "Đang khám"
                    : "Đã hoàn tất"}
              </Text>
              <View style={styles.divider} />
              <Text style={styles.label}>MẪU PHIẾU</Text>
              <Text style={styles.value}>{record.template_id}</Text>
              <Text style={styles.secondary}>
                Tạo lúc {dateLabel(record.created_at)}
              </Text>
              {record.instructions ? (
                <>
                  <View style={styles.divider} />
                  <Text style={styles.label}>KẾT LUẬN / HƯỚNG DẪN</Text>
                  <Text style={styles.secondary}>{record.instructions}</Text>
                </>
              ) : null}
            </View>

            {isDoctor && record.assigned_doctor_id === session.user.user_id ? (
              <>
                <PatientUas7 session={session} patientId={record.patient_id} />
                <LesionTimeline
                  key={record.medical_record_id}
                  session={session}
                  patientId={record.patient_id}
                  patient={false}
                  editable={false}
                />
              </>
            ) : null}

            {canAccept ? (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Tiếp nhận lần khám</Text>
                <Text style={styles.secondary}>
                  Sau khi tiếp nhận, lần khám được gán cho bạn và chuyển sang
                  trạng thái đang khám.
                </Text>
                {confirming ? (
                  <>
                    <Text style={styles.confirmText}>
                      Xác nhận tiếp nhận lần khám này?
                    </Text>
                    <Pressable
                      disabled={saving}
                      onPress={() => void accept()}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryText}>
                        {saving ? "Đang xử lý..." : "Xác nhận tiếp nhận"}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={saving}
                      onPress={() => setConfirming(false)}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelText}>Hủy</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => setConfirming(true)}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryText}>Tiếp nhận</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {sections.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>Nội dung lần khám</Text>
                <MedicalRecordQuestionnaire
                  sections={sections}
                  role={role === "doctor" ? "doctor" : "patient"}
                  answers={answers}
                  onChange={(questionId, answer) =>
                    setAnswers((current) => ({
                      ...current,
                      [questionId]: answer,
                    }))
                  }
                  readOnly={!canEdit}
                />
                {canEdit ? (
                  <Pressable
                    disabled={saving}
                    onPress={() => void saveAnswers()}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryText}>
                      {saving ? "Đang lưu..." : "Lưu câu trả lời"}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}

            {canComplete ? (
              <View style={styles.actionCard}>
                <Text style={styles.actionTitle}>Hoàn tất lần khám</Text>
                <Text style={styles.secondary}>
                  Ghi kết luận hoặc hướng dẫn dành cho bệnh nhân trước khi chốt
                  hồ sơ.
                </Text>
                <TextInput
                  value={instructions}
                  onChangeText={setInstructions}
                  multiline
                  placeholder="Kết luận, hướng dẫn dùng thuốc hoặc tái khám"
                  style={styles.instructionsInput}
                />
                {confirming ? (
                  <>
                    <Text style={styles.confirmText}>
                      Sau khi hoàn tất, lần khám và câu trả lời sẽ không thể
                      chỉnh sửa.
                    </Text>
                    <Pressable
                      disabled={saving}
                      onPress={() => void complete()}
                      style={styles.primaryButton}
                    >
                      <Text style={styles.primaryText}>
                        {saving ? "Đang hoàn tất..." : "Xác nhận hoàn tất"}
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={saving}
                      onPress={() => setConfirming(false)}
                      style={styles.cancelButton}
                    >
                      <Text style={styles.cancelText}>Hủy</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={() => setConfirming(true)}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryText}>Chốt lần khám</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 30,
    paddingBottom: 42,
  },
  eyebrow: {
    color: appColors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    marginTop: 12,
    color: appColors.ink,
    fontSize: 29,
    fontWeight: "800",
  },
  loading: { marginTop: 30 },
  card: {
    marginTop: 24,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: appColors.border,
    backgroundColor: appColors.surface,
  },
  label: {
    color: appColors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  value: {
    marginTop: 7,
    color: appColors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  secondary: {
    marginTop: 7,
    color: appColors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  divider: { height: 1, backgroundColor: appColors.border, marginVertical: 18 },
  actionCard: {
    marginTop: 16,
    padding: 22,
    borderRadius: 20,
    backgroundColor: appColors.primarySoft,
  },
  actionTitle: { color: appColors.ink, fontSize: 18, fontWeight: "800" },
  sectionTitle: {
    marginTop: 24,
    color: appColors.ink,
    fontSize: 20,
    fontWeight: "800",
  },
  confirmText: {
    marginTop: 16,
    color: appColors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 18,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: appColors.primary,
  },
  primaryText: { color: appColors.surface, fontSize: 14, fontWeight: "800" },
  cancelButton: { alignItems: "center", padding: 15 },
  cancelText: { color: appColors.primaryDark, fontSize: 14, fontWeight: "700" },
  message: {
    marginTop: 18,
    padding: 20,
    borderRadius: 18,
    backgroundColor: appColors.surface,
  },
  successCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 14,
    backgroundColor: appColors.primarySoft,
  },
  success: { color: appColors.primaryDark, fontWeight: "700" },
  error: { color: "#B42336", fontSize: 14, marginBottom: 10 },
  retry: { color: appColors.primary, fontSize: 14, fontWeight: "800" },
  instructionsInput: {
    minHeight: 100,
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 12,
    backgroundColor: appColors.surface,
    color: appColors.ink,
    textAlignVertical: "top",
  },
});
