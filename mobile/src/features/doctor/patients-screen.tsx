import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
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
import { PatientForm } from "./patient-form";
import { LesionTimeline } from "@/features/tracking/lesion-timeline";
import { PatientUas7 } from "./patient-uas7";
import { CreatePatientRecord } from "./create-patient-record";
import { patientsApi, type Patient, type PatientHistory } from "./patients-api";

const statusLabels = {
  pending: "Chờ tiếp nhận",
  in_progress: "Đang khám",
  completed: "Đã hoàn tất",
};

export function PatientsScreen({ session }: { session: Session }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [history, setHistory] = useState<PatientHistory[]>([]);
  const [creating, setCreating] = useState(false);
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = useRef(0);
  const scroll = useRef<ScrollView>(null);
  useEffect(
    () => () => {
      requestId.current += 1;
    },
    [],
  );

  async function run(action: (isCurrent: () => boolean) => Promise<void>) {
    const id = ++requestId.current;
    const isCurrent = () => id === requestId.current;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action(isCurrent);
    } catch (caught) {
      if (isCurrent())
        setError(
          caught instanceof Error
            ? caught.message
            : "Không thực hiện được yêu cầu.",
        );
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  function search() {
    if (!phone.trim() && !name.trim()) {
      setError("Nhập tên hoặc số điện thoại để tìm bệnh nhân.");
      return;
    }
    void run(async (isCurrent) => {
      const result = await patientsApi.search(session, phone, name);
      if (isCurrent()) {
        setPatients(result);
        setSearched(true);
      }
    });
  }

  function showHistory(patient: Patient) {
    setSelected(patient);
    setHistory([]);
    scroll.current?.scrollTo({ y: 0, animated: true });
    void run(async (isCurrent) => {
      const result = await patientsApi.history(session, patient.user_id);
      if (isCurrent()) setHistory(result);
    });
  }

  async function create(input: Record<string, string | number>) {
    await run(async (isCurrent) => {
      const patient = await patientsApi.create(session, input);
      if (isCurrent()) {
        setCreating(false);
        setPatients([patient]);
        setSearched(true);
        setPhone(patient.phone);
        setName("");
        setNotice(`Đã tạo hồ sơ cho ${patient.full_name}.`);
      }
    });
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Bệnh nhân</Text>
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {busy ? <ActivityIndicator color={appColors.primary} /> : null}
        {selected && creatingRecord ? (
          <CreatePatientRecord
            session={session}
            patient={selected}
            onCancel={() => setCreatingRecord(false)}
            onCreated={(record) => {
              setHistory((current) => [
                record,
                ...current.filter(
                  (item) => item.medical_record_id !== record.medical_record_id,
                ),
              ]);
              setCreatingRecord(false);
              router.push({
                pathname: "/medical-records/[id]",
                params: { id: String(record.medical_record_id) },
              });
            }}
          />
        ) : selected ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setSelected(null);
                setError(null);
              }}
              style={styles.action}
            >
              <Text style={styles.link}>← Về tìm kiếm</Text>
            </Pressable>
            <PatientCard patient={selected} />
            <LesionTimeline
              key={`photos-${selected.user_id}`}
              session={session}
              patientId={selected.user_id}
              patient={false}
              editable={false}
            />
            <PatientUas7
              key={selected.user_id}
              session={session}
              patientId={selected.user_id}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              style={styles.button}
              onPress={() => {
                setCreatingRecord(true);
                setError(null);
                setNotice(null);
                scroll.current?.scrollTo({ y: 0, animated: true });
              }}
            >
              <Text style={styles.buttonText}>
                + Tạo lần khám cho bệnh nhân này
              </Text>
            </Pressable>
            <Text style={styles.heading}>Lịch sử lần khám</Text>
            <Text style={styles.muted}>
              Chỉ hiển thị lần khám bạn được phép xem.
            </Text>
            {!busy && !error && history.length === 0 ? (
              <Text style={styles.muted}>
                Chưa có lần khám trong phạm vi truy cập của bạn.
              </Text>
            ) : null}
            {!busy
              ? history.map((record) => (
                  <Pressable
                    key={record.medical_record_id}
                    accessibilityRole="button"
                    style={styles.card}
                    onPress={() =>
                      router.push({
                        pathname: "/medical-records/[id]",
                        params: { id: String(record.medical_record_id) },
                      })
                    }
                  >
                    <Text style={styles.heading}>
                      Lần khám #{record.medical_record_id} ·{" "}
                      {statusLabels[record.status]}
                    </Text>
                    <Text style={styles.muted}>
                      {new Date(record.created_at).toLocaleString("vi-VN")}
                    </Text>
                    {record.instructions ? (
                      <Text style={styles.muted}>{record.instructions}</Text>
                    ) : null}
                    <Text style={styles.link}>Mở lần khám →</Text>
                  </Pressable>
                ))
              : null}
            {error && !busy ? (
              <Pressable
                onPress={() => showHistory(selected)}
                style={styles.action}
              >
                <Text style={styles.link}>Thử lại</Text>
              </Pressable>
            ) : null}
          </>
        ) : creating ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setCreating(false);
                setError(null);
              }}
              style={styles.action}
            >
              <Text style={styles.link}>← Hủy tạo, về tìm kiếm</Text>
            </Pressable>
            <PatientForm saving={busy} onSubmit={create} />
          </>
        ) : (
          <>
            <Text style={styles.muted}>
              Tìm theo đầu số điện thoại hoặc một phần họ tên. Có thể kết hợp cả
              hai.
            </Text>
            <TextInput
              accessibilityLabel="Số điện thoại tìm kiếm"
              placeholder="Số điện thoại"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="Họ tên tìm kiếm"
              placeholder="Họ tên bệnh nhân"
              value={name}
              onChangeText={setName}
              maxLength={150}
              style={styles.input}
              onSubmitEditing={() => {
                if (!busy) search();
              }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={search}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Tìm bệnh nhân</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                setCreating(true);
                setError(null);
                setNotice(null);
              }}
              style={styles.action}
            >
              <Text style={styles.link}>+ Tạo hồ sơ bệnh nhân mới</Text>
            </Pressable>
            {!busy && searched && !error && patients.length === 0 ? (
              <Text style={styles.muted}>
                Không tìm thấy bệnh nhân phù hợp.
              </Text>
            ) : null}
            {!busy
              ? patients.map((patient) => (
                  <Pressable
                    key={patient.user_id}
                    accessibilityRole="button"
                    onPress={() => showHistory(patient)}
                  >
                    <PatientCard patient={patient} />
                    <Text style={styles.link}>Xem lịch sử lần khám →</Text>
                  </Pressable>
                ))
              : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PatientCard({ patient }: { patient: Patient }) {
  const gender = patient.gender
    ? { male: "Nam", female: "Nữ", other: "Khác" }[patient.gender]
    : "Chưa cập nhật";
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>{patient.full_name}</Text>
      <Text style={styles.muted}>
        Mã BN: {patient.user_id} · {patient.phone}
      </Text>
      <Text style={styles.muted}>
        Giới tính: {gender} · Năm sinh:{" "}
        {patient.year_of_birth ?? "Chưa cập nhật"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: appColors.canvas },
  content: {
    padding: 22,
    gap: 14,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 48,
  },
  title: { fontSize: 28, color: appColors.ink, fontWeight: "800" },
  heading: { fontSize: 16, fontWeight: "700", color: appColors.ink },
  muted: { color: appColors.muted, lineHeight: 22 },
  error: { color: "#B42336" },
  notice: { color: appColors.primaryDark },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: appColors.border,
    padding: 12,
    backgroundColor: appColors.surface,
    color: appColors.ink,
  },
  button: {
    backgroundColor: appColors.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  action: { minHeight: 44, justifyContent: "center" },
  link: { color: appColors.primary, fontWeight: "700" },
  card: {
    padding: 16,
    gap: 6,
    borderRadius: 14,
    backgroundColor: appColors.surface,
    borderWidth: 1,
    borderColor: appColors.border,
  },
});
