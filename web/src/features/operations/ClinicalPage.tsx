import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-context";
import { roleFromId } from "@/features/auth/auth-types";
import { ApiError } from "@/lib/api/client";
import type { MedicalRecordDetail } from "@/features/medical-records/medical-records-api";
import { label, message, useApi, useData, type Row } from "./api";
import { Alert, Modal, ResourcePanel } from "./shared";

type Medicine = {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instruction: string;
};
type Prescription = {
  prescription_id: string;
  note: string | null;
  items: (Medicine & { prescription_item_id: string })[];
};
type LabItem = {
  id: string;
  test_name: string;
  description: string | null;
  result_value: string | null;
  result_note: string | null;
};
type LabRequest = {
  id: string;
  status: string;
  note: string | null;
  items: LabItem[];
};
const emptyMedicine = (): Medicine => ({
  medicine_name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instruction: "",
});

function PrescriptionEditor({
  recordId,
  onSaved,
  onClose,
}: {
  recordId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [items, setItems] = useState<Medicine[]>([emptyMedicine()]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/prescriptions", "POST", {
        medical_record_id: String(recordId),
        note: note.trim() || null,
        items: items.map((item) =>
          Object.fromEntries(
            Object.entries(item).map(([key, value]) => [
              key,
              value.trim() || null,
            ]),
          ),
        ),
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Kê đơn · Bệnh án #${recordId}`}
      onClose={onClose}
      busy={busy}
    >
      <form className="ops-form" onSubmit={(e) => void save(e)}>
        <fieldset disabled={busy}>
          {items.map((item, index) => (
            <section className="ops-subform" key={index}>
              <div className="ops-section-heading">
                <h3>Thuốc {index + 1}</h3>
                <Button
                  type="button"
                  variant="quiet"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((before) => before.filter((_, i) => i !== index))
                  }
                >
                  Bỏ thuốc
                </Button>
              </div>
              <div className="ops-form-grid">
                {(
                  [
                    { key: "medicine_name", label: "Tên thuốc" },
                    { key: "dosage", label: "Liều dùng" },
                    { key: "frequency", label: "Tần suất" },
                    { key: "duration", label: "Thời gian dùng" },
                    { key: "instruction", label: "Hướng dẫn thêm" },
                  ] as { key: keyof Medicine; label: string }[]
                ).map((field) => (
                  <label className="ops-field" key={field.key}>
                    {field.label}
                    {field.key !== "instruction" ? " *" : ""}
                    <input
                      required={field.key !== "instruction"}
                      maxLength={field.key === "instruction" ? 10000 : 255}
                      value={item[field.key]}
                      onChange={(e) =>
                        setItems((before) =>
                          before.map((m, i) =>
                            i === index
                              ? { ...m, [field.key]: e.target.value }
                              : m,
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </section>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={items.length >= 100}
            onClick={() => setItems((before) => [...before, emptyMedicine()])}
          >
            Thêm thuốc
          </Button>
          <label className="ops-field">
            Ghi chú đơn thuốc
            <textarea
              rows={3}
              maxLength={10000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </fieldset>
        <Alert>{error}</Alert>
        <p className="ops-help">
          Mỗi bệnh án chỉ có một đơn thuốc. Kiểm tra nội dung trước khi lưu.
        </p>
        <div className="ops-form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu đơn thuốc"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PrescriptionPanel({
  recordId,
  writable,
}: {
  recordId: number;
  writable: boolean;
}) {
  const api = useApi();
  const [data, setData] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    api<Prescription>(
      `/prescriptions/${recordId}`,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result.data);
      })
      .catch((caught: unknown) => {
        if (
          !controller.signal.aborted &&
          !(caught instanceof ApiError && caught.code === "2008")
        )
          setError(message(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, recordId, revision]);
  return (
    <Panel
      title="Đơn thuốc"
      className="ops-resource"
      action={
        !loading && !error && !data && writable ? (
          <Button size="small" onClick={() => setCreating(true)}>
            Kê đơn thuốc
          </Button>
        ) : undefined
      }
    >
      {error ? (
        <div className="ops-state">
          <Alert>{error}</Alert>
          <Button variant="secondary" onClick={() => setRevision((v) => v + 1)}>
            Thử lại
          </Button>
        </div>
      ) : loading ? (
        <div className="ops-state" role="status">
          Đang tải đơn thuốc…
        </div>
      ) : data ? (
        <div className="ops-inset">
          <p className="ops-help">Đơn thuốc #{data.prescription_id}</p>
          <ol className="ops-prescription">
            {data.items.map((item) => (
              <li key={item.prescription_item_id}>
                <strong>{item.medicine_name}</strong>
                <p>
                  {item.dosage} · {item.frequency} · {item.duration}
                </p>
                {item.instruction ? <small>{item.instruction}</small> : null}
              </li>
            ))}
          </ol>
          {data.note ? <p className="ops-note">{data.note}</p> : null}
        </div>
      ) : (
        <div className="ops-state">Bệnh án chưa có đơn thuốc.</div>
      )}
      {creating ? (
        <PrescriptionEditor
          recordId={recordId}
          onClose={() => setCreating(false)}
          onSaved={() => setRevision((v) => v + 1)}
        />
      ) : null}
    </Panel>
  );
}

function LabRequestEditor({
  recordId,
  onSaved,
  onClose,
}: {
  recordId: number;
  onSaved: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [items, setItems] = useState([{ test_name: "", description: "" }]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/lab-requests", "POST", {
        medical_record_id: String(recordId),
        note: note.trim() || null,
        items: items.map((item) => ({
          test_name: item.test_name.trim(),
          description: item.description.trim() || null,
        })),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Chỉ định xét nghiệm · Bệnh án #${recordId}`}
      onClose={onClose}
      busy={busy}
    >
      <form className="ops-form" onSubmit={(e) => void save(e)}>
        <fieldset disabled={busy}>
          {items.map((item, index) => (
            <div className="ops-subform" key={index}>
              <div className="ops-form-grid">
                <label className="ops-field">
                  Tên xét nghiệm *
                  <input
                    required
                    maxLength={255}
                    value={item.test_name}
                    onChange={(e) =>
                      setItems((before) =>
                        before.map((row, i) =>
                          i === index
                            ? { ...row, test_name: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
                <label className="ops-field">
                  Mô tả
                  <input
                    maxLength={10000}
                    value={item.description}
                    onChange={(e) =>
                      setItems((before) =>
                        before.map((row, i) =>
                          i === index
                            ? { ...row, description: e.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <Button
                type="button"
                variant="quiet"
                disabled={items.length === 1}
                onClick={() =>
                  setItems((before) => before.filter((_, i) => i !== index))
                }
              >
                Bỏ xét nghiệm
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={items.length >= 100}
            onClick={() =>
              setItems((before) => [
                ...before,
                { test_name: "", description: "" },
              ])
            }
          >
            Thêm xét nghiệm
          </Button>
          <label className="ops-field">
            Ghi chú
            <textarea
              rows={3}
              maxLength={10000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        </fieldset>
        <Alert>{error}</Alert>
        <div className="ops-form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button disabled={busy}>{busy ? "Đang lưu…" : "Lưu chỉ định"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function LabResultsEditor({
  request,
  onSaved,
  onClose,
}: {
  request: LabRequest;
  onSaved: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      request.items.map((item) => [
        item.id,
        {
          result_value: item.result_value ?? "",
          result_note: item.result_note ?? "",
        },
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const results = Object.entries(values)
        .filter(([, value]) => value.result_value.trim())
        .map(([id, value]) => ({
          lab_request_item_id: id,
          result_value: value.result_value.trim(),
          result_note: value.result_note.trim() || null,
        }));
      if (!results.length)
        throw new Error("Nhập ít nhất một kết quả xét nghiệm.");
      await api("/lab-results", "POST", {
        lab_request_id: request.id,
        results,
      });
      onSaved();
      onClose();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`Nhập kết quả · Phiếu #${request.id}`}
      onClose={onClose}
      busy={busy}
    >
      <form className="ops-form" onSubmit={(e) => void save(e)}>
        <fieldset disabled={busy}>
          <p className="ops-help">
            Có thể lưu từng phần. Kết quả cũ được cập nhật khi bạn nhập lại.
          </p>
          {request.items.map((item) => (
            <section className="ops-subform" key={item.id}>
              <h3>{item.test_name}</h3>
              <label className="ops-field">
                Kết quả
                <textarea
                  aria-label="Kết quả"
                  rows={2}
                  maxLength={10000}
                  value={values[item.id].result_value}
                  onChange={(e) =>
                    setValues((before) => ({
                      ...before,
                      [item.id]: {
                        ...before[item.id],
                        result_value: e.target.value,
                      },
                    }))
                  }
                />
              </label>
              <label className="ops-field">
                Nhận xét
                <input
                  maxLength={10000}
                  value={values[item.id].result_note}
                  onChange={(e) =>
                    setValues((before) => ({
                      ...before,
                      [item.id]: {
                        ...before[item.id],
                        result_note: e.target.value,
                      },
                    }))
                  }
                />
              </label>
            </section>
          ))}
        </fieldset>
        <Alert>{error}</Alert>
        <div className="ops-form-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button disabled={busy}>{busy ? "Đang lưu…" : "Lưu kết quả"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function LabsPanel({
  recordId,
  writable,
}: {
  recordId: number;
  writable: boolean;
}) {
  const { can } = useAuth();
  const requests = useData<LabRequest[]>(`/lab-results/${recordId}`, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LabRequest | null>(null);
  return (
    <Panel
      title={
        <span className="resource-title">
          <Icon name="lab" />
          Chỉ định và kết quả xét nghiệm
        </span>
      }
      className="ops-resource clinical-results"
      action={
        writable &&
        can("POST", "/lab-requests") &&
        !requests.loading &&
        !requests.error ? (
          <Button
            size="small"
            icon={<Icon name="plus" size={16} />}
            onClick={() => setCreating(true)}
          >
            Chỉ định xét nghiệm
          </Button>
        ) : undefined
      }
    >
      {requests.error ? (
        <div className="ops-state">
          <Alert>{requests.error}</Alert>
          <Button variant="secondary" onClick={requests.reload}>
            Thử lại
          </Button>
        </div>
      ) : requests.loading ? (
        <div className="ops-state" role="status">
          Đang tải xét nghiệm…
        </div>
      ) : requests.data.length ? (
        <div className="ops-inset">
          {requests.data.map((request) => (
            <section className="ops-lab" key={request.id}>
              <div className="ops-section-heading">
                <h3>
                  <Icon name="clipboard" size={18} /> Phiếu #{request.id}{" "}
                  <span
                    className={`ops-pill${request.status === "completed" ? " ops-pill--green" : ""}`}
                  >
                    {request.status === "completed"
                      ? "Đủ kết quả"
                      : request.status === "in_progress"
                        ? "Đang có kết quả"
                        : "Chờ kết quả"}
                  </span>
                </h3>
                {writable && can("POST", "/lab-results") ? (
                  <Button
                    size="small"
                    variant="secondary"
                    icon={<Icon name="edit" size={15} />}
                    onClick={() => setEditing(request)}
                  >
                    Nhập kết quả
                  </Button>
                ) : null}
              </div>
              {request.note ? <p className="ops-help">{request.note}</p> : null}
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>XÉT NGHIỆM</th>
                      <th>KẾT QUẢ</th>
                      <th>NHẬN XÉT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {request.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.test_name}</strong>
                          {item.description ? (
                            <small className="ops-block">
                              {item.description}
                            </small>
                          ) : null}
                        </td>
                        <td>
                          <span
                            className={
                              item.result_value
                                ? "clinical-result-value"
                                : "clinical-result-pending"
                            }
                          >
                            {item.result_value ?? "Chưa có kết quả"}
                          </span>
                        </td>
                        <td>{label(item.result_note)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="clinical-empty">
          <span>
            <Icon name="lab" size={30} />
          </span>
          <strong>Chưa có chỉ định xét nghiệm</strong>
          <p>
            {writable
              ? "Tạo chỉ định để bắt đầu theo dõi và cập nhật kết quả cho bệnh án này."
              : "Các chỉ định và kết quả sẽ xuất hiện tại đây khi bác sĩ cập nhật."}
          </p>
        </div>
      )}
      {creating ? (
        <LabRequestEditor
          recordId={recordId}
          onClose={() => setCreating(false)}
          onSaved={requests.reload}
        />
      ) : null}
      {editing ? (
        <LabResultsEditor
          request={editing}
          onClose={() => setEditing(null)}
          onSaved={requests.reload}
        />
      ) : null}
    </Panel>
  );
}

export function ClinicalRecord({
  record,
  mode = "both",
}: {
  record: MedicalRecordDetail;
  mode?: "labs" | "prescriptions" | "both";
}) {
  const { session, can } = useAuth();
  const isDoctor = !!session && roleFromId(session.user) === "doctor";
  const writable =
    isDoctor &&
    record.assigned_doctor_id === session.user.user_id &&
    record.status === "in_progress";
  if (isDoctor && record.assigned_doctor_id !== session.user.user_id)
    return (
      <Panel>
        <p className="ops-inset">
          Tiếp nhận bệnh án để xem xét nghiệm và kê đơn.
        </p>
      </Panel>
    );
  return (
    <div className="ops-stack">
      {record.status === "completed" ? (
        <p className="ops-help">Bệnh án đã hoàn tất. Dữ liệu chỉ được xem.</p>
      ) : null}
      {mode !== "prescriptions" &&
      can("GET", `/lab-results/${record.medical_record_id}`) ? (
        <LabsPanel recordId={record.medical_record_id} writable={writable} />
      ) : null}
      {mode !== "labs" &&
      can("GET", `/prescriptions/${record.medical_record_id}`) ? (
        <PrescriptionPanel
          recordId={record.medical_record_id}
          writable={writable && can("POST", "/prescriptions")}
        />
      ) : null}
    </div>
  );
}

function SelectedRecord({
  id,
  mode,
}: {
  id: string;
  mode: "labs" | "prescriptions";
}) {
  const record = useData<MedicalRecordDetail | null>(
    `/medical_records/${id}`,
    null,
  );
  return (
    <>
      <Alert>{record.error}</Alert>
      {record.error ? (
        <Button variant="secondary" onClick={record.reload}>
          Thử lại
        </Button>
      ) : record.loading ? (
        <div className="ops-state" role="status">
          Đang tải bệnh án…
        </div>
      ) : record.data ? (
        <>
          <div className="ops-context">
            <span className="clinical-record-icon">
              <Icon name="records" />
            </span>
            <strong>Bệnh án #{record.data.medical_record_id}</strong>
            <span>Bệnh nhân #{record.data.patient_id}</span>
            <StatusBadge status={record.data.status} />
            <Link to={`/app/records/${id}`}>
              Xem hồ sơ đầy đủ <Icon name="arrow" size={15} />
            </Link>
          </div>
          <ClinicalRecord record={record.data} mode={mode} />
        </>
      ) : null}
    </>
  );
}

export function ClinicalPage({ mode }: { mode: "labs" | "prescriptions" }) {
  const [params, setParams] = useSearchParams();
  const recordId = params.get("record");
  const [search, setSearch] = useState(recordId ?? "");
  return (
    <div className="clinical-page">
      <PageHeader
        eyebrow="CHĂM SÓC VÀ ĐIỀU TRỊ"
        title={mode === "labs" ? "Xét nghiệm" : "Đơn thuốc"}
        description={
          mode === "labs"
            ? "Quản lý chỉ định, theo dõi và cập nhật kết quả xét nghiệm theo bệnh án."
            : "Tra cứu và quản lý đơn thuốc theo từng bệnh án."
        }
      />
      <form
        className="clinical-lookup"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[1-9]\d*$/.test(search)) setParams({ record: search });
        }}
      >
        <div className="clinical-lookup__intro">
          <span className="clinical-lookup__icon">
            <Icon name={mode === "labs" ? "lab" : "prescription"} size={24} />
          </span>
          <div>
            <strong>Tra cứu bệnh án</strong>
            <p>Nhập mã để mở nhanh hoặc chọn trong danh sách bên dưới.</p>
          </div>
        </div>
        <label className="clinical-lookup__input">
          <Icon name="search" size={18} />
          <span className="sr-only">Mã bệnh án</span>
          <input
            type="number"
            min={1}
            step={1}
            required
            placeholder="Nhập mã bệnh án"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button type="submit" icon={<Icon name="arrow" size={16} />}>
          Mở bệnh án
        </Button>
        {recordId ? (
          <Button
            variant="quiet"
            type="button"
            icon={<Icon name="records" size={16} />}
            onClick={() => {
              setParams({});
              setSearch("");
            }}
          >
            Chọn bệnh án khác
          </Button>
        ) : null}
      </form>
      {recordId && /^[1-9]\d*$/.test(recordId) ? (
        <SelectedRecord key={`${mode}-${recordId}`} id={recordId} mode={mode} />
      ) : (
        <ResourcePanel
          title="Danh sách bệnh án"
          titleIcon={<Icon name="records" size={20} />}
          path="/medical_records"
          listPath="/medical_records/all"
          fields={[]}
          paginated
          pageSize={5}
          canCreate={false}
          canEdit={false}
          canDelete={false}
          columns={[
            {
              key: "medical_record_id",
              label: "BỆNH ÁN",
              render: (row: Row) => (
                <span className="clinical-record-cell">
                  <span className="clinical-record-icon">
                    <Icon name="records" size={18} />
                  </span>
                  <strong>#{String(row.medical_record_id)}</strong>
                </span>
              ),
            },
            {
              key: "patient_id",
              label: "BỆNH NHÂN",
              render: (row: Row) => (
                <span className="clinical-patient">
                  <Icon name="user" size={15} />
                  Bệnh nhân #{String(row.patient_id)}
                </span>
              ),
            },
            {
              key: "template_id",
              label: "MẪU PHIẾU",
              render: (row: Row) => (
                <span className="clinical-template">
                  <Icon name="template" size={14} />
                  {label(row.template_id)}
                </span>
              ),
            },
            {
              key: "status",
              label: "TRẠNG THÁI",
              render: (row: Row) => (
                <StatusBadge
                  status={
                    row.status === "pending"
                      ? "pending"
                      : row.status === "in_progress"
                        ? "in_progress"
                        : row.status === "completed"
                          ? "completed"
                          : "unavailable"
                  }
                />
              ),
            },
          ]}
          actions={(row) => (
            <Button
              variant="secondary"
              size="small"
              icon={<Icon name="arrow" size={14} />}
              onClick={() => {
                const id = String(row.medical_record_id);
                setSearch(id);
                setParams({ record: id });
              }}
            >
              {mode === "labs" ? "Xem xét nghiệm" : "Xem đơn thuốc"}
            </Button>
          )}
        />
      )}
    </div>
  );
}
