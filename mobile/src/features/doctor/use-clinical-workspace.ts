import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import type { Session } from "@/features/auth/session";
import {
  clinicalOrdersApi,
  type LabRequest,
  type Prescription,
} from "./clinical-orders-api";
import type { MedicalRecordListItem } from "./medical-records-api";

export type WorkspaceMode = "labs" | "prescriptions";
type TestDraft = { test_name: string; description: string };
type MedicineDraft = {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instruction: string;
};
type ResultDraft = { result_value: string; result_note: string };

const emptyTest = (): TestDraft => ({ test_name: "", description: "" });
const emptyMedicine = (): MedicineDraft => ({
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instruction: "",
});

export function useClinicalWorkspace(session: Session, mode: WorkspaceMode) {
  const [records, setRecords] = useState<MedicalRecordListItem[]>([]);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [tests, setTests] = useState<TestDraft[]>([emptyTest()]);
  const [medicines, setMedicines] = useState<MedicineDraft[]>([
    emptyMedicine(),
  ]);
  const [note, setNote] = useState("");
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(
    async (active: () => boolean) => {
      setLoading(true);
      setError(null);
      try {
        const result = await clinicalOrdersApi.activeRecords(session);
        if (active()) setRecords(result);
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
    [session],
  );

  const refreshSelected = useCallback(
    async (active: () => boolean = () => true) => {
      if (recordId === null) return;
      if (active()) {
        setLoading(true);
        setError(null);
      }
      try {
        if (mode === "labs") {
          const requests = await clinicalOrdersApi.labRequests(
            session,
            recordId,
          );
          if (!active()) return;
          setLabRequests(requests);
          const drafts: Record<string, ResultDraft> = {};
          for (const request of requests) {
            for (const item of request.items) {
              drafts[item.id] = {
                result_value: item.result_value ?? "",
                result_note: item.result_note ?? "",
              };
            }
          }
          if (active()) setResultDrafts(drafts);
        } else {
          const result = await clinicalOrdersApi.prescription(
            session,
            recordId,
          );
          if (active()) setPrescription(result);
        }
      } catch (caught) {
        if (active())
          setError(
            caught instanceof Error
              ? caught.message
              : "Không tải được dữ liệu.",
          );
      } finally {
        if (active()) setLoading(false);
      }
    },
    [mode, recordId, session],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (recordId === null) void loadRecords(() => active);
      else void refreshSelected(() => active);
      return () => {
        active = false;
      };
    }, [loadRecords, recordId, refreshSelected]),
  );

  function setTest(index: number, field: keyof TestDraft, value: string) {
    setTests((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function setMedicine(
    index: number,
    field: keyof MedicineDraft,
    value: string,
  ) {
    setMedicines((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function setResult(itemId: string, field: keyof ResultDraft, value: string) {
    setResultDrafts((current) => ({
      ...current,
      [itemId]: { ...current[itemId], [field]: value },
    }));
  }

  async function createLabRequest() {
    if (recordId === null || saving) return;
    const items = tests.map((item) => ({
      test_name: item.test_name.trim(),
      description: item.description.trim(),
    }));
    if (items.some((item) => !item.test_name)) {
      setError("Vui lòng nhập tên cho tất cả xét nghiệm.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await clinicalOrdersApi.createLabRequest(session, {
        medical_record_id: String(recordId),
        note: note.trim(),
        items,
      });
      setTests([emptyTest()]);
      setNote("");
      setSuccess("Đã tạo phiếu chỉ định xét nghiệm.");
      await refreshSelected();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không tạo được phiếu xét nghiệm.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveResults(request: LabRequest) {
    if (saving) return;
    const results = request.items
      .filter((item) => resultDrafts[item.id]?.result_value.trim())
      .map((item) => ({
        lab_request_item_id: item.id,
        result_value: resultDrafts[item.id].result_value.trim(),
        result_note: resultDrafts[item.id].result_note.trim(),
      }));
    if (results.length === 0) {
      setError("Nhập kết quả ít nhất một xét nghiệm trước khi lưu.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await clinicalOrdersApi.enterLabResults(session, {
        lab_request_id: request.id,
        results,
      });
      setSuccess("Đã lưu kết quả xét nghiệm.");
      await refreshSelected();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không lưu được kết quả xét nghiệm.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function createPrescription() {
    if (recordId === null || saving) return;
    const items = medicines.map((item) => ({
      medicine_name: item.medicine_name.trim(),
      dosage: item.dosage.trim(),
      frequency: item.frequency.trim(),
      duration: item.duration.trim(),
      instruction: item.instruction.trim(),
    }));
    if (
      items.some(
        (item) =>
          !item.medicine_name ||
          !item.dosage ||
          !item.frequency ||
          !item.duration,
      )
    ) {
      setError(
        "Vui lòng điền tên thuốc, liều dùng, tần suất và thời gian cho tất cả thuốc.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await clinicalOrdersApi.createPrescription(session, {
        medical_record_id: String(recordId),
        note: note.trim(),
        items,
      });
      setPrescription(created);
      setSuccess("Đã kê đơn thuốc cho lần khám.");
      setMedicines([emptyMedicine()]);
      setNote("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không tạo được đơn thuốc.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectRecord(id: number | null) {
    setRecordId(id);
    setError(null);
    setSuccess(null);
  }

  function addTest() {
    setTests((items) => [...items, emptyTest()]);
  }

  function addMedicine() {
    setMedicines((items) => [...items, emptyMedicine()]);
  }

  return {
    records,
    recordId,
    labRequests,
    prescription,
    tests,
    medicines,
    note,
    resultDrafts,
    loading,
    saving,
    error,
    success,
    selectRecord,
    setNote,
    setTest,
    setMedicine,
    setResult,
    addTest,
    addMedicine,
    createLabRequest,
    saveResults,
    createPrescription,
  };
}
