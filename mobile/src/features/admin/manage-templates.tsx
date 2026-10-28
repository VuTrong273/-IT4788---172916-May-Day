import { useCallback, useRef } from "react";
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
import type { Session } from "@/features/auth/session";
import { useManageTemplates } from "./use-manage-templates";

export function ManageTemplates({ session }: { session: Session }) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollToForm = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  const {
    templates,
    form,
    setField,
    loading,
    saving,
    error,
    notice,
    editing,
    deleteCode,
    setDeleteCode,
    resetForm,
    edit,
    remove,
    saveTemplate,
  } = useManageTemplates(session, scrollToForm);

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>QUẢN TRỊ / MẪU PHIẾU</Text>
        <Text style={styles.title}>Mẫu phiếu</Text>
        <Text style={styles.subtitle}>
          Mẫu phiếu là bộ câu hỏi dùng cho từng lần khám. Phiếu đã điền thuộc lần khám; nhật ký ảnh và UAS7 được theo dõi riêng theo bệnh nhân.
        </Text>

        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {editing ? "Chỉnh sửa mẫu phiếu" : "Tạo mẫu mới"}
          </Text>
          <Text style={styles.label}>Mã mẫu phiếu</Text>
          <TextInput
            value={form.code_template}
            editable={!editing && !saving}
            onChangeText={(value) => setField("code_template", value)}
            autoCapitalize="characters"
            placeholder="VD: TPL_INTAKE_V1"
            style={styles.input}
            maxLength={225}
          />
          <Text style={styles.label}>Tên mẫu phiếu</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => setField("name", value)}
            placeholder="Tên hiển thị cho bệnh nhân"
            style={styles.input}
            maxLength={255}
          />
          <Text style={styles.label}>Mô tả</Text>
          <TextInput
            value={form.description}
            onChangeText={(value) => setField("description", value)}
            placeholder="Mô tả ngắn"
            multiline
            style={[styles.input, styles.description]}
          />
          <Text style={styles.label}>Phiên bản</Text>
          <TextInput
            value={form.version}
            onChangeText={(value) => setField("version", value)}
            placeholder="1.0"
            style={styles.input}
            maxLength={20}
          />
          <Pressable
            onPress={() =>
              setField("is_active", form.is_active === "1" ? "0" : "1")
            }
            style={styles.toggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.is_active === "1" }}
          >
            <View
              style={[
                styles.checkbox,
                form.is_active === "1" && styles.checked,
              ]}
            />
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>Kích hoạt mẫu</Text>
              <Text style={styles.muted}>
                Mẫu hoạt động sẽ xuất hiện khi bệnh nhân tạo lần khám.
              </Text>
            </View>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.success}>{notice}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void saveTemplate()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>
              {saving
                ? "Đang xử lý..."
                : editing
                  ? "Lưu thay đổi"
                  : "Tạo mẫu phiếu"}
            </Text>
          </Pressable>
          {editing ? (
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={resetForm}
              style={styles.action}
            >
              <Text>Hủy chỉnh sửa</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.section}>Các mẫu đã tạo</Text>
        {loading ? (
          <ActivityIndicator color={appColors.primary} style={styles.loading} />
        ) : null}
        {!loading && templates.length === 0 ? (
          <Text style={styles.muted}>Chưa có mẫu phiếu nào.</Text>
        ) : null}
        {!loading
          ? templates.map((template) => (
              <View key={template.code_template} style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardTitle}>{template.name}</Text>
                  <Text
                    style={[
                      styles.status,
                      template.is_active === "1" && styles.activeStatus,
                    ]}
                  >
                    {template.is_active === "1"
                      ? "Hoạt động"
                      : "Chưa kích hoạt"}
                  </Text>
                </View>
                <Text style={styles.code}>
                  {template.code_template} · v{template.version}
                </Text>
                {template.description ? (
                  <Text style={styles.muted}>{template.description}</Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={() => edit(template)}
                  style={styles.action}
                >
                  <Text style={styles.success}>Sửa / bật tắt mẫu</Text>
                </Pressable>
                {deleteCode === template.code_template ? (
                  <View>
                    <Text style={styles.error}>
                      Xóa mẫu này cùng các phần và câu hỏi? Thao tác không thể
                      hoàn tác.
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void remove(template.code_template)}
                      style={styles.action}
                    >
                      <Text style={styles.error}>Xác nhận xóa</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => setDeleteCode(null)}
                      style={styles.action}
                    >
                      <Text>Hủy xóa</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => setDeleteCode(template.code_template)}
                    style={styles.action}
                  >
                    <Text style={styles.error}>Xóa mẫu</Text>
                  </Pressable>
                )}
              </View>
            ))
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  action: { minHeight: 44, justifyContent: "center" },
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
  subtitle: {
    marginTop: 8,
    color: appColors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  form: {
    marginTop: 26,
    padding: 20,
    borderRadius: 20,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  formTitle: { color: appColors.ink, fontSize: 18, fontWeight: "800" },
  label: {
    marginTop: 18,
    marginBottom: 7,
    color: appColors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    color: appColors.ink,
    backgroundColor: appColors.surface,
    fontSize: 14,
  },
  description: { minHeight: 84, paddingTop: 13, textAlignVertical: "top" },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderWidth: 2,
    borderRadius: 6,
    borderColor: appColors.primary,
  },
  checked: { backgroundColor: appColors.primary },
  toggleCopy: { flex: 1 },
  toggleTitle: { color: appColors.ink, fontSize: 14, fontWeight: "700" },
  muted: { marginTop: 5, color: appColors.muted, fontSize: 12, lineHeight: 18 },
  error: { marginTop: 18, color: "#B42336", fontSize: 13 },
  success: {
    marginTop: 18,
    color: appColors.primaryDark,
    fontSize: 13,
    fontWeight: "700",
  },
  button: {
    marginTop: 22,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: appColors.primary,
  },
  buttonText: { color: appColors.surface, fontSize: 14, fontWeight: "800" },
  section: {
    marginTop: 28,
    marginBottom: 12,
    color: appColors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  loading: { marginTop: 18 },
  card: {
    marginBottom: 10,
    padding: 18,
    borderRadius: 16,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 9,
  },
  cardTitle: { flex: 1, color: appColors.ink, fontSize: 15, fontWeight: "800" },
  status: { color: appColors.warmInk, fontSize: 11, fontWeight: "700" },
  activeStatus: { color: appColors.primaryDark },
  code: { marginTop: 8, color: appColors.muted, fontSize: 11 },
});
