import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { ChoiceField, formStyles as styles } from "./choice-field";

const pad = (value: number) => String(value).padStart(2, "0");
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export function DateField({
  label,
  value,
  onChange,
  disabled = false,
  withTime = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  withTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState("");
  const [hour, setHour] = useState("00");
  const [minute, setMinute] = useState("00");
  function begin() {
    const parsed = value
      ? new Date(value.length === 10 ? `${value}T12:00:00` : value)
      : new Date();
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelected(localDate(date));
    setHour(pad(date.getHours()));
    setMinute(pad(date.getMinutes()));
    setOpen(true);
  }
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={begin}
        style={styles.input}
      >
        <Text>
          {value
            ? `${value.slice(0, 10).split("-").reverse().join("/")}${withTime ? ` ${value.slice(11, 16)}` : ""}`
            : "Chọn ngày"}
        </Text>
      </Pressable>
      <Modal
        visible={open && !disabled}
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 12 }}
            >
              <Text style={styles.label}>{label}</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <ChoiceField
                  label="Tháng"
                  value={String(month.getMonth() + 1)}
                  options={Array.from({ length: 12 }, (_, n) => String(n + 1))}
                  onChange={(next) => {
                    if (next)
                      setMonth(
                        new Date(month.getFullYear(), Number(next) - 1, 1),
                      );
                  }}
                />
                <ChoiceField
                  label="Năm"
                  value={String(month.getFullYear())}
                  options={Array.from(
                    { length: new Date().getFullYear() - 1900 + 11 },
                    (_, n) => String(new Date().getFullYear() + 10 - n),
                  )}
                  onChange={(next) => {
                    if (next)
                      setMonth(new Date(Number(next), month.getMonth(), 1));
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Pressable
                  accessibilityLabel="Tháng trước"
                  style={styles.option}
                  onPress={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    )
                  }
                >
                  <Text>←</Text>
                </Pressable>
                <Text>
                  {month.getMonth() + 1}/{month.getFullYear()}
                </Text>
                <Pressable
                  accessibilityLabel="Tháng sau"
                  style={styles.option}
                  onPress={() =>
                    setMonth(
                      new Date(month.getFullYear(), month.getMonth() + 1, 1),
                    )
                  }
                >
                  <Text>→</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                  <Text
                    key={day}
                    style={{ width: "14.28%", textAlign: "center" }}
                  >
                    {day}
                  </Text>
                ))}
                {Array.from({ length: offset + days }, (_, index) => {
                  const day = index - offset + 1;
                  if (day < 1)
                    return <View key={index} style={{ width: "14.28%" }} />;
                  const date = `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(day)}`;
                  return (
                    <Pressable
                      key={index}
                      accessibilityLabel={date}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selected === date }}
                      onPress={() => setSelected(date)}
                      style={[
                        {
                          width: "14.28%",
                          minHeight: 44,
                          justifyContent: "center",
                          alignItems: "center",
                          borderRadius: 8,
                        },
                        selected === date && styles.selected,
                      ]}
                    >
                      <Text>{day}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {withTime ? (
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <ChoiceField
                    label="Giờ"
                    value={hour}
                    onChange={(next) => setHour(next || "00")}
                    options={Array.from({ length: 24 }, (_, n) => pad(n))}
                  />
                  <ChoiceField
                    label="Phút"
                    value={minute}
                    onChange={(next) => setMinute(next || "00")}
                    options={Array.from({ length: 60 }, (_, n) => pad(n))}
                  />
                </View>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    const now = new Date();
                    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                    setSelected(localDate(now));
                    setHour(pad(now.getHours()));
                    setMinute(pad(now.getMinutes()));
                  }}
                >
                  <Text>Hôm nay</Text>
                </Pressable>
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Text>Bỏ chọn</Text>
                </Pressable>
                <Pressable style={styles.option} onPress={() => setOpen(false)}>
                  <Text>Hủy</Text>
                </Pressable>
                <Pressable
                  style={[styles.option, styles.selected]}
                  onPress={() => {
                    onChange(
                      withTime ? `${selected}T${hour}:${minute}` : selected,
                    );
                    setOpen(false);
                  }}
                >
                  <Text>Chọn {selected.split("-").reverse().join("/")}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
