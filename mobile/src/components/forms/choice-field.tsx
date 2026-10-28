import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { appColors } from "@/constants/app-theme";

/** Explicit selection only: suggestions never become saved values automatically. */
export function ChoiceField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  allowCustom = false,
  maxLength = 255,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  disabled?: boolean;
  allowCustom?: boolean;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState(false);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
  function select(next: string) {
    onChange(next);
    setOpen(false);
    setCustom(false);
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        style={[styles.input, disabled && { opacity: 0.5 }]}
      >
        <Text style={styles.text}>{value || "Chọn…"} ▾</Text>
      </Pressable>
      {allowCustom && custom ? (
        <TextInput
          accessibilityLabel={`${label} khác`}
          value={value}
          onChangeText={onChange}
          editable={!disabled}
          maxLength={maxLength}
          placeholder="Nhập nội dung khác"
          style={styles.input}
        />
      ) : null}
      <Modal
        visible={open && !disabled}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              accessibilityLabel={`Tìm ${label}`}
              placeholder="Tìm lựa chọn…"
              value={search}
              onChangeText={setSearch}
              style={styles.input}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              <Pressable style={styles.option} onPress={() => select("")}>
                <Text>Bỏ chọn</Text>
              </Pressable>
              {options
                .filter((item) => normalize(item).includes(normalize(search)))
                .map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: item === value }}
                    style={[styles.option, item === value && styles.selected]}
                    onPress={() => select(item)}
                  >
                    <Text>
                      {item === value ? "✓ " : ""}
                      {item}
                    </Text>
                  </Pressable>
                ))}
              {allowCustom ? (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    setCustom(true);
                    setOpen(false);
                  }}
                >
                  <Text>Khác / nhập nội dung riêng</Text>
                </Pressable>
              ) : null}
            </ScrollView>
            <Pressable style={styles.option} onPress={() => setOpen(false)}>
              <Text style={styles.label}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  field: { gap: 8, marginVertical: 6 },
  label: { color: appColors.ink, fontWeight: "700" },
  text: { color: appColors.ink },
  input: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 12,
    backgroundColor: appColors.surface,
    color: appColors.ink,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#0007",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: appColors.surface,
    padding: 20,
    borderRadius: 18,
    maxHeight: "80%",
    gap: 12,
  },
  option: { padding: 14, minHeight: 48, borderRadius: 10 },
  selected: { backgroundColor: appColors.primarySoft },
});
const styles = formStyles;
