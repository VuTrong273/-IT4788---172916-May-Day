import { useState } from "react";
import { ChoiceField } from "@/components/forms/choice-field";
import { careers } from "@/components/forms/form-options";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { appColors } from "@/constants/app-theme";

const fields = [
  { key: "full_name", label: "Họ tên *", limit: 150 },
  { key: "phone", label: "Số điện thoại *", limit: 10 },
  { key: "password", label: "Mật khẩu ban đầu * (ít nhất 6 ký tự)", limit: 72 },
  { key: "year_of_birth", label: "Năm sinh", limit: 4 },
  { key: "career", label: "Nghề nghiệp", limit: 150 },
] as const;

export function PatientForm({
  saving,
  onSubmit,
}: {
  saving: boolean;
  onSubmit: (input: Record<string, string | number>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const name = values.full_name?.trim();
    const phone = values.phone?.trim();
    const password = values.password ?? "";
    if (!name || !phone || !password) {
      setError("Nhập họ tên, số điện thoại và mật khẩu.");
      return;
    }
    if (!/^(03|05|07|08|09)\d{8}$/.test(phone)) {
      setError("Số điện thoại cần đúng 10 số, đầu 03/05/07/08/09.");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu cần ít nhất 6 ký tự.");
      return;
    }
    const year = values.year_of_birth?.trim();
    if (
      year &&
      (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100)
    ) {
      setError("Năm sinh phải từ 1900 đến 2100.");
      return;
    }
    const input: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) input[key] = key === "password" ? value : value.trim();
    }
    if (year) input.year_of_birth = Number(year);
    setError(null);
    void onSubmit(input);
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Tạo hồ sơ bệnh nhân</Text>
      <Text style={styles.hint}>
        Dành cho bệnh nhân chưa có tài khoản. Bệnh nhân có thể đăng nhập bằng số
        điện thoại và mật khẩu ban đầu.
      </Text>
      {fields.map(({ key, label, limit }) => (
        <View key={key}>
          {!["year_of_birth", "career"].includes(
            key,
          ) ? (
            <Text style={styles.label}>{label}</Text>
          ) : null}
          {key === "year_of_birth" || key === "career" ? (
            <ChoiceField
              label={label}
              value={values[key] ?? ""}
              onChange={(value) =>
                setValues((current) => ({ ...current, [key]: value }))
              }
              options={
                key === "career"
                  ? careers
                  : Array.from(
                      { length: new Date().getFullYear() - 1899 },
                      (_, n) => String(new Date().getFullYear() - n),
                    )
              }
              allowCustom={key === "career"}
              maxLength={limit}
              disabled={saving}
            />
          ) : (
            <TextInput
              accessibilityLabel={label}
              editable={!saving}
              value={values[key] ?? ""}
              onChangeText={(value) =>
                setValues((current) => ({ ...current, [key]: value }))
              }
              secureTextEntry={key === "password"}
              autoCapitalize={key === "password" ? "none" : "sentences"}
              autoCorrect={false}
              keyboardType={
                key === "phone"
                  ? "number-pad"
                  : "default"
              }
              maxLength={limit}
              style={styles.input}
            />
          )}
        </View>
      ))}
      <Text style={styles.label}>Giới tính</Text>
      <View style={styles.choices}>
        {[
          ["", "Chưa chọn"],
          ["male", "Nam"],
          ["female", "Nữ"],
          ["other", "Khác"],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ selected: (values.gender ?? "") === key }}
            disabled={saving}
            onPress={() =>
              setValues((current) => ({ ...current, gender: key }))
            }
            style={[
              styles.choice,
              (values.gender ?? "") === key && styles.selected,
            ]}
          >
            <Text>{label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={submit}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {saving ? "Đang tạo..." : "Tạo bệnh nhân"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 10 },
  title: { fontSize: 22, fontWeight: "700", color: appColors.ink },
  hint: { color: appColors.muted, lineHeight: 21 },
  label: { color: appColors.ink, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 10,
    minHeight: 48,
    padding: 12,
    color: appColors.ink,
    backgroundColor: appColors.surface,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    padding: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 10,
  },
  selected: { backgroundColor: appColors.warm },
  error: { color: "#B42336" },
  button: {
    padding: 16,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: appColors.primary,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
