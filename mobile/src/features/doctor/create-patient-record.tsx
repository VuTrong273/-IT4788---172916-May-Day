import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { appColors } from "@/constants/app-theme";
import type { Session } from "@/features/auth/session";
import type { Patient } from "./patients-api";
import {
  medicalRecordsApi,
  type MedicalRecord,
  type RecordTemplate,
} from "./medical-records-api";

export function CreatePatientRecord({
  session,
  patient,
  onCreated,
  onCancel,
}: {
  session: Session;
  patient: Patient;
  onCreated: (record: MedicalRecord) => void;
  onCancel: () => void;
}) {
  const [templates, setTemplates] = useState<RecordTemplate[]>([]);
  const [selected, setSelected] = useState<RecordTemplate | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<MedicalRecord | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    medicalRecordsApi
      .activeTemplates(session, page)
      .then((result) => {
        if (!active) return;
        setTemplates(result.data);
        setTotalPages(Math.max(1, Math.ceil(result.total / result.limit)));
      })
      .catch((caught: unknown) => {
        if (active) {
          setTemplates([]);
          setError(
            caught instanceof Error
              ? caught.message
              : "Không tải được mẫu phiếu.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, page, reload]);

  function loadPage(nextPage: number) {
    setLoading(true);
    setError(null);
    setSelected(null);
    setPage(nextPage);
    setReload((value) => value + 1);
  }

  async function create() {
    if (!selected || loading || submitting.current || created) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    let result: MedicalRecord;
    try {
      result = await medicalRecordsApi.createForPatient(
        session,
        patient.user_id,
        selected.code_template,
      );
    } catch (caught) {
      if (mounted.current)
        setError(
          caught instanceof Error ? caught.message : "Không tạo được lần khám.",
        );
      return;
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
    if (!mounted.current) return;
    setCreated(result);
    onCreated(result);
  }

  if (created)
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>
          Đã tạo lần khám #{created.medical_record_id}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => onCreated(created)}
        >
          <Text style={styles.buttonText}>Mở lần khám</Text>
        </Pressable>
      </View>
    );

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Tạo lần khám cho {patient.full_name}</Text>
      <Text style={styles.body}>
        Mã BN: {patient.user_id} · SĐT: {patient.phone}
      </Text>
      <Text style={styles.body}>
        Chọn mẫu phiếu đang hoạt động. Lần khám mới sẽ ở trạng thái chờ; tiếp
        nhận tại trang chi tiết để bắt đầu khám.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator color={appColors.primary} />
      ) : (
        <>
          {templates.length === 0 && !error ? (
            <Text style={styles.body}>
              Chưa có mẫu phiếu hoạt động. Liên hệ quản trị viên để kích hoạt
              mẫu.
            </Text>
          ) : null}
          {templates.map((template) => (
            <Pressable
              key={template.code_template}
              accessibilityRole="radio"
              accessibilityState={{
                selected: selected?.code_template === template.code_template,
                disabled: saving,
              }}
              disabled={saving}
              onPress={() => setSelected(template)}
              style={[
                styles.template,
                selected?.code_template === template.code_template &&
                  styles.selected,
              ]}
            >
              <Text style={styles.title}>
                {selected?.code_template === template.code_template ? "✓ " : ""}
                {template.name}
              </Text>
              <Text style={styles.body}>
                {template.code_template} · v{template.version}
              </Text>
              {template.description ? (
                <Text style={styles.body}>{template.description}</Text>
              ) : null}
            </Pressable>
          ))}
          <View style={styles.pages}>
            <Pressable
              accessibilityRole="button"
              disabled={saving || page <= 1}
              onPress={() => loadPage(page - 1)}
              style={styles.action}
            >
              <Text style={saving || page <= 1 ? styles.body : styles.link}>
                Trang trước
              </Text>
            </Pressable>
            <Text style={styles.body}>
              {page} / {totalPages}
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={saving || page >= totalPages}
              onPress={() => loadPage(page + 1)}
              style={styles.action}
            >
              <Text
                style={saving || page >= totalPages ? styles.body : styles.link}
              >
                Trang sau
              </Text>
            </Pressable>
          </View>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={loading || saving}
        onPress={() => loadPage(page)}
        style={styles.action}
      >
        <Text style={styles.link}>Tải lại mẫu phiếu</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={!selected || loading || saving}
        onPress={() => void create()}
        style={[
          styles.button,
          (!selected || loading || saving) && styles.disabled,
        ]}
      >
        <Text style={styles.buttonText}>
          {saving ? "Đang tạo..." : "Tạo và mở lần khám"}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={onCancel}
        style={styles.action}
      >
        <Text style={styles.link}>Hủy tạo lần khám</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 14 },
  title: { color: appColors.ink, fontSize: 17, fontWeight: "700" },
  body: { color: appColors.muted, lineHeight: 21 },
  error: { color: "#B42336" },
  template: {
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: appColors.surface,
  },
  selected: { borderColor: appColors.primary, backgroundColor: appColors.warm },
  button: {
    backgroundColor: appColors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.5 },
  action: { minHeight: 44, justifyContent: "center" },
  link: { color: appColors.primary, fontWeight: "700" },
  pages: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
