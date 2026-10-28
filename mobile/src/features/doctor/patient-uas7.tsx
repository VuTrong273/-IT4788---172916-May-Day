import { useCallback, useState } from "react";
import { DateField } from "@/components/forms/date-field";
import { useFocusedReload } from "@/hooks/use-focused-reload";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { Session } from "@/features/auth/session";
import {
  uas7Api,
  type Uas7Entry,
  type Uas7Week,
} from "@/features/patient/uas7-api";
import { trackingStyles as styles } from "@/features/tracking/tracking-styles";

function shift(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function PatientUas7({
  session,
  patientId,
}: {
  session: Session;
  patientId: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(!open)}
        style={styles.action}
      >
        <Text style={styles.title}>{open ? "Ẩn" : "Xem"} điểm UAS7</Text>
      </Pressable>
      {open ? <Scores session={session} patientId={patientId} /> : null}
    </View>
  );
}
function Scores({
  session,
  patientId,
}: {
  session: Session;
  patientId: number;
}) {
  const [start, setStart] = useState(() =>
    shift(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
      -6,
    ),
  );
  const [input, setInput] = useState(start);
  const [entries, setEntries] = useState<Uas7Entry[]>([]);
  const [week, setWeek] = useState<Uas7Week | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useFocusedReload(
    useCallback(
      async (isCurrent: () => boolean) => {
        setLoading(true);
        setError(null);
        try {
          const [history, total] = await Promise.all([
            uas7Api.patientHistory(session, patientId),
            uas7Api.patientWeek(session, patientId, start),
          ]);
          if (isCurrent()) {
            setEntries(history);
            setWeek(total);
          }
        } catch (caught) {
          if (isCurrent())
            setError(
              caught instanceof Error ? caught.message : "Không tải được UAS7.",
            );
        } finally {
          if (isCurrent()) setLoading(false);
        }
      },
      [session, patientId, start],
    ),
  );
  function change(value: string) {
    if (!validDate(value)) {
      setError("Ngày bắt đầu phải đúng YYYY-MM-DD.");
      return;
    }
    setStart(value);
    setInput(value);
    if (value === start) reload();
  }
  const end = shift(start, 6);
  return (
    <View style={styles.stack}>
      <DateField
        label="Ngày bắt đầu tuần UAS7"
        value={input}
        onChange={setInput}
      />
      <Pressable onPress={() => change(input)} style={styles.action}>
        <Text style={styles.link}>Xem tuần</Text>
      </Pressable>
      <View style={styles.row}>
        <Pressable
          onPress={() => change(shift(start, -7))}
          style={styles.action}
        >
          <Text style={styles.link}>← Tuần trước</Text>
        </Pressable>
        <Pressable
          onPress={() => change(shift(start, 7))}
          style={styles.action}
        >
          <Text style={styles.link}>Tuần sau →</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <>
          <Text style={styles.title}>
            {start} → {end}
          </Text>
          <Text style={styles.title}>
            Tổng điểm: {week?.week_score ?? 0}/42 · {week?.completed_days ?? 0}
            /7 ngày
          </Text>
          {Number(week?.completed_days) < 7 ? (
            <Text style={styles.body}>
              Chưa đủ dữ liệu 7 ngày; tổng hiện tại chỉ gồm những ngày đã ghi
              nhận.
            </Text>
          ) : null}
          {entries
            .filter((e) => e.score_date >= start && e.score_date <= end)
            .map((entry) => (
              <View key={entry.score_date} style={styles.card}>
                <Text style={styles.title}>
                  {entry.score_date} · {entry.daily_score}/6
                </Text>
                <Text style={styles.body}>
                  Ngứa: {entry.iss7}/3 · Mề đay: {entry.hss7}/3
                </Text>
                {entry.note ? (
                  <Text style={styles.body}>{entry.note}</Text>
                ) : null}
              </View>
            ))}
          <Text style={styles.title}>Lịch sử ({entries.length} ngày)</Text>
          {!entries.length ? (
            <Text style={styles.body}>Bệnh nhân chưa ghi nhận điểm UAS7.</Text>
          ) : (
            entries.map((entry) => (
              <Text key={entry.score_date} style={styles.body}>
                {entry.score_date}: {entry.daily_score}/6 · Lần khám #
                {entry.medical_record_id}
              </Text>
            ))
          )}
        </>
      )}
    </View>
  );
}
