import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { appColors } from "@/constants/app-theme";
import type { Uas7Score } from './uas7-api';
import { shiftDay, trendDays } from "./uas7-trend-data";

const displayDate = (date: string) => date.split("-").reverse().join("/");
export function Uas7Trend({ entries }: { entries: Uas7Score[] }) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [length, setLength] = useState(7);
  const [end, setEnd] = useState(today);
  const [endInput, setEndInput] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const days = trendDays(entries, end, length);
  const recorded = days.filter((day) => day.score !== null);
  const detail = days.find((day) => day.date === selected);
  const average = recorded.length
    ? (
        recorded.reduce((sum, day) => sum + day.score!, 0) / recorded.length
      ).toFixed(1)
    : null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Diễn biến điểm theo ngày</Text>
      <Text style={styles.body}>
        Mỗi cột là điểm một ngày (0–6), không phải tổng UAS7 của cả tuần.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: filtersOpen }}
        style={[styles.button, { alignSelf: "flex-start" }]}
        onPress={() => setFiltersOpen((open) => !open)}
      >
        <Text>
          {filtersOpen ? "Thu gọn bộ lọc" : `Bộ lọc · ${length} ngày`}
        </Text>
      </Pressable>
      {filtersOpen ? (
        <View style={{ gap: 12 }}>
          <View style={styles.row}>
            {[7, 14, 30].map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: length === value }}
                onPress={() => {
                  setLength(value);
                  setSelected(null);
                }}
                style={[styles.button, length === value && styles.active]}
              >
                <Text>{value} ngày</Text>
              </Pressable>
            ))}
          </View>
          <View>
            <Text style={styles.body}>Xem đến ngày (YYYY-MM-DD)</Text>
            <TextInput
              accessibilityLabel="Xem đến ngày"
              value={endInput}
              onChangeText={setEndInput}
              onBlur={() => {
                const valid = /^\d{4}-\d{2}-\d{2}$/.test(endInput) && !Number.isNaN(Date.parse(endInput));
                if (valid) {
                  setEnd(endInput > today ? today : endInput);
                  setSelected(null);
                } else {
                  setEndInput(end);
                }
              }}
              style={styles.button}
            />
          </View>
          <View style={styles.row}>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => {
                const previous = shiftDay(end, -length);
                setEnd(previous);
                setEndInput(previous);
                setSelected(null);
              }}
            >
              <Text>← Trước</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              disabled={end >= today}
              onPress={() => {
                const next = shiftDay(end, length);
                setEnd(next > today ? today : next);
                setEndInput(next > today ? today : next);
                setSelected(null);
              }}
            >
              <Text style={end >= today && styles.muted}>Sau →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => {
                setEnd(today);
                setEndInput(today);
                setSelected(null);
              }}
            >
              <Text>Gần nhất</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Text style={styles.body}>
        {displayDate(days[0].date)} – {displayDate(end)}
      </Text>
      <Text style={styles.body}>
        Đã ghi {recorded.length}/{length} ngày
        {average !== null ? ` · Trung bình ngày đã ghi: ${average}/6` : ""}
      </Text>
      <Text style={styles.body}>
        —: chưa ghi · 0: đã ghi, điểm bằng 0. Chạm cột để xem chi tiết; vuốt
        ngang để xem hết.
      </Text>
      {!recorded.length ? (
        <Text style={styles.body}>
          Chưa có điểm trong khoảng thời gian này.
        </Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.chart}
      >
        {days.map((day) => (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityLabel={`${displayDate(day.date)}: ${day.score === null ? "chưa ghi" : `${day.score} trên 6 điểm`}`}
            accessibilityState={{ selected: selected === day.date }}
            onPress={() => setSelected(day.date)}
            style={[styles.column, selected === day.date && styles.active]}
          >
            <Text style={styles.score}>{day.score ?? "—"}</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.bar,
                  {
                    height:
                      day.score === null ? 0 : Math.max(3, day.score * 20),
                  },
                ]}
              />
            </View>
            <Text style={styles.date}>
              {day.date.slice(8)}/{day.date.slice(5, 7)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {detail ? (
        <View style={styles.detail}>
          <Text style={styles.title}>{displayDate(detail.date)}</Text>
          {detail.entry ? (
            <>
              <Text style={styles.body}>
                Tổng: {detail.score}/6 · Ngứa: {detail.entry.iss7}/3 · Mề đay:{" "}
                {detail.entry.hss7}/3
              </Text>
              <Text style={styles.body}>
                {detail.entry.note || "Không có ghi chú."}
              </Text>
            </>
          ) : (
            <Text style={styles.body}>Ngày này chưa được ghi nhận.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    padding: 16,
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: appColors.border,
    backgroundColor: appColors.surface,
  },
  title: { color: appColors.ink, fontSize: 16, fontWeight: "700" },
  body: { color: appColors.muted, lineHeight: 21 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 10,
  },
  active: { backgroundColor: appColors.primarySoft },
  muted: { opacity: 0.4 },
  chart: { gap: 4, paddingVertical: 8 },
  column: {
    width: 44,
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  track: {
    height: 120,
    width: 24,
    backgroundColor: appColors.canvas,
    justifyContent: "flex-end",
    borderBottomWidth: 1,
    borderColor: appColors.border,
  },
  bar: { width: 24, backgroundColor: appColors.primary, borderRadius: 4 },
  score: { fontWeight: "700", color: appColors.ink },
  date: { fontSize: 11, color: appColors.muted },
  detail: {
    padding: 12,
    gap: 6,
    backgroundColor: appColors.canvas,
    borderRadius: 10,
  },
});
