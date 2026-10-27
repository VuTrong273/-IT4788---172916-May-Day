import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { appColors } from "@/constants/app-theme";
import type { Session } from "@/features/auth/session";
import {
  clinicalOrdersApi,
  type LabRequest,
  type Prescription,
} from "@/features/doctor/clinical-orders-api";
import { patientRecordsApi, type PatientRecord } from "./patient-records-api";

type RecordResults = {
  record: PatientRecord;
  prescription: Prescription | null;
  labRequests: LabRequest[];
};

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { dateStyle: "medium" });
}

export function MyResults({ session }: { session: Session }) {
  const [results, setResults] = useState<RecordResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (active: () => boolean) => {
      setLoading(true);
      setError(null);
      try {
        const records = await patientRecordsApi.history(session);
        const details = await Promise.all(
          records.map(async (record) => {
            const [prescription, labRequests] = await Promise.all([
              clinicalOrdersApi.prescription(session, record.medical_record_id),
              clinicalOrdersApi.labRequests(session, record.medical_record_id),
            ]);
            return { record, prescription, labRequests };
          }),
        );
        if (active()) setResults(details);
      } catch (caught) {
        if (active())
          setError(
            caught instanceof Error
              ? caught.message
              : "Không tải được kết quả.",
          );
      } finally {
        if (active()) setLoading(false);
      }
    },
    [session],
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>SỨC KHỎE / KẾT QUẢ</Text>
        <Text style={styles.title}>Kết quả và đơn thuốc</Text>
        <Text style={styles.subtitle}>
          Xem chỉ định xét nghiệm, kết quả và đơn thuốc gắn với từng bệnh án.
        </Text>
        {loading ? (
          <ActivityIndicator color={appColors.primary} style={styles.loading} />
        ) : null}
        {error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load(() => true)}>
              <Text style={styles.retry}>Tải lại</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading && !error && results.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Chưa có bệnh án</Text>
            <Text style={styles.body}>
              Kết quả xét nghiệm và đơn thuốc sẽ xuất hiện tại đây sau khi bác
              sĩ tạo.
            </Text>
          </View>
        ) : null}
        {results.map(({ record, prescription, labRequests }) => {
          const hasContent = Boolean(prescription) || labRequests.length > 0;
          return (
            <View key={record.medical_record_id} style={styles.recordCard}>
              <Text style={styles.recordTitle}>
                Bệnh án #{record.medical_record_id}
              </Text>
              <Text style={styles.meta}>
                Ngày tạo: {dateLabel(record.created_at)} ·{" "}
                {record.status === "completed"
                  ? "Đã hoàn tất"
                  : record.status === "in_progress"
                    ? "Đang khám"
                    : "Chờ tiếp nhận"}
              </Text>
              {record.instructions ? (
                <Text style={styles.body}>
                  Hướng dẫn: {record.instructions}
                </Text>
              ) : null}
              {!hasContent ? (
                <Text style={styles.body}>
                  Chưa có chỉ định xét nghiệm hoặc đơn thuốc.
                </Text>
              ) : null}

              {labRequests.map((request) => (
                <View key={request.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    Xét nghiệm ·{" "}
                    {request.status === "completed"
                      ? "Đã có kết quả"
                      : request.status === "in_progress"
                        ? "Đang cập nhật"
                        : "Chờ thực hiện"}
                  </Text>
                  {request.note ? (
                    <Text style={styles.body}>{request.note}</Text>
                  ) : null}
                  {request.items.map((item) => (
                    <View key={item.id} style={styles.item}>
                      <Text style={styles.itemTitle}>{item.test_name}</Text>
                      {item.description ? (
                        <Text style={styles.body}>{item.description}</Text>
                      ) : null}
                      <Text style={styles.resultLabel}>KẾT QUẢ</Text>
                      <Text style={styles.body}>
                        {item.result_value || "Chưa có kết quả"}
                      </Text>
                      {item.result_note ? (
                        <Text style={styles.body}>
                          Ghi chú: {item.result_note}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}

              {prescription ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Đơn thuốc</Text>
                  {prescription.note ? (
                    <Text style={styles.body}>{prescription.note}</Text>
                  ) : null}
                  {prescription.items.map((item) => (
                    <View key={item.prescription_item_id} style={styles.item}>
                      <Text style={styles.itemTitle}>{item.medicine_name}</Text>
                      <Text style={styles.body}>Liều dùng: {item.dosage}</Text>
                      <Text style={styles.body}>
                        Tần suất: {item.frequency} · Thời gian: {item.duration}
                      </Text>
                      {item.instruction ? (
                        <Text style={styles.body}>
                          Hướng dẫn: {item.instruction}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
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
  subtitle: {
    marginTop: 8,
    color: appColors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  loading: { marginTop: 30 },
  card: {
    marginTop: 22,
    padding: 20,
    borderRadius: 18,
    backgroundColor: appColors.surface,
  },
  recordCard: {
    marginTop: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: appColors.border,
    borderRadius: 18,
    backgroundColor: appColors.surface,
  },
  recordTitle: { color: appColors.ink, fontSize: 18, fontWeight: "800" },
  cardTitle: { color: appColors.ink, fontSize: 17, fontWeight: "800" },
  meta: { marginTop: 7, color: appColors.muted, fontSize: 12 },
  section: {
    marginTop: 16,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: appColors.border,
  },
  sectionTitle: {
    color: appColors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },
  item: {
    marginTop: 12,
    padding: 13,
    borderRadius: 13,
    backgroundColor: appColors.canvas,
  },
  itemTitle: { color: appColors.ink, fontSize: 14, fontWeight: "800" },
  resultLabel: {
    marginTop: 10,
    color: appColors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  body: { marginTop: 7, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  error: { color: "#B42336", fontSize: 14 },
  retry: { marginTop: 12, color: appColors.primary, fontWeight: "800" },
});
