import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError } from '@/lib/api/client';
import type { MedicalRecordDetail } from '@/features/medical-records/medical-records-api';
import { label, message, useApi, useData, type Row } from './api';
import { Alert, Modal, ResourcePanel } from './shared';

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
  medicine_name: '',
  dosage: '',
  frequency: '',
  duration: '',
  instruction: '',
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
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/prescriptions', 'POST', {
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
                    { key: 'medicine_name', label: 'Tên thuốc' },
                    { key: 'dosage', label: 'Liều dùng' },
                    { key: 'frequency', label: 'Tần suất' },
                    { key: 'duration', label: 'Thời gian dùng' },
                    { key: 'instruction', label: 'Hướng dẫn thêm' },
                  ] as { key: keyof Medicine; label: string }[]
                ).map((field) => (
                  <label className="ops-field" key={field.key}>
                    {field.label}
                    {field.key !== 'instruction' ? ' *' : ''}
                    <input
                      required={field.key !== 'instruction'}
                      maxLength={field.key === 'instruction' ? 10000 : 255}
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
            {busy ? 'Đang lưu…' : 'Lưu đơn thuốc'}
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
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    api<Prescription>(
      `/prescriptions/${recordId}`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (!controller.signal.aborted) setData(result.data);
      })
      .catch((caught: unknown) => {
        if (
          !controller.signal.aborted &&
          !(caught instanceof ApiError && caught.code === '2008')
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
  const [items, setItems] = useState([{ test_name: '', description: '' }]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/lab-requests', 'POST', {
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
                { test_name: '', description: '' },
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
          <Button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu chỉ định'}</Button>
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
          result_value: item.result_value ?? '',
          result_note: item.result_note ?? '',
        },
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const results = Object.entries(values)
        .filter(([, value]) => value.result_value.trim())
        .map(([id, value]) => ({
          lab_request_item_id: id,
          result_value: value.result_value.trim(),
          result_note: value.result_note.trim() || null,
        }));
      if (!results.length)
        throw new Error('Nhập ít nhất một kết quả xét nghiệm.');
      await api('/lab-results', 'POST', {
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
          <Button disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu kết quả'}</Button>
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
  const requests = useData<LabRequest[]>(`/lab-results/${recordId}`, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LabRequest | null>(null);
  return (
    <Panel
      title="Xét nghiệm"
      className="ops-resource"
      action={
        writable && !requests.loading && !requests.error ? (
          <Button size="small" onClick={() => setCreating(true)}>
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
                  Phiếu #{request.id}{' '}
                  <span
                    className={`ops-pill${request.status === 'completed' ? ' ops-pill--green' : ''}`}
                  >
                    {request.status === 'completed'
                      ? 'Đủ kết quả'
                      : request.status === 'in_progress'
                        ? 'Đang có kết quả'
                        : 'Chờ kết quả'}
                  </span>
                </h3>
                {writable ? (
                  <Button
                    size="small"
                    variant="secondary"
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
                        <td>{item.result_value ?? 'Chưa có kết quả'}</td>
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
        <div className="ops-state">Chưa có chỉ định xét nghiệm.</div>
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
  mode = 'both',
}: {
  record: MedicalRecordDetail;
  mode?: 'labs' | 'prescriptions' | 'both';
}) {
  const { session } = useAuth();
  const isDoctor = session?.user.role_id === 2;
  const writable =
    isDoctor &&
    record.assigned_doctor_id === session.user.user_id &&
    record.status === 'in_progress';
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
      {record.status === 'completed' ? (
        <p className="ops-help">Bệnh án đã hoàn tất. Dữ liệu chỉ được xem.</p>
      ) : null}
      {mode !== 'prescriptions' ? (
        <LabsPanel recordId={record.medical_record_id} writable={writable} />
      ) : null}
      {mode !== 'labs' ? (
        <PrescriptionPanel
          recordId={record.medical_record_id}
          writable={writable}
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
  mode: 'labs' | 'prescriptions';
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
            <strong>Bệnh án #{record.data.medical_record_id}</strong>
            <span>Bệnh nhân #{record.data.patient_id}</span>
            <Link to={`/app/records/${id}`}>Mở hồ sơ bệnh án →</Link>
          </div>
          <ClinicalRecord record={record.data} mode={mode} />
        </>
      ) : null}
    </>
  );
}

export function ClinicalPage({ mode }: { mode: 'labs' | 'prescriptions' }) {
  const [params, setParams] = useSearchParams();
  const recordId = params.get('record');
  const [search, setSearch] = useState(recordId ?? '');
  return (
    <>
      <PageHeader
        eyebrow="CHĂM SÓC VÀ ĐIỀU TRỊ"
        title={mode === 'labs' ? 'Xét nghiệm' : 'Đơn thuốc'}
        description="Chọn bệnh án để xem dữ liệu và thực hiện thao tác trong phạm vi được phân công."
      />
      <form
        className="ops-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^[1-9]\d*$/.test(search)) setParams({ record: search });
        }}
      >
        <label className="ops-filter">
          Mã bệnh án
          <input
            type="number"
            min={1}
            step={1}
            required
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary">
          Mở bệnh án
        </Button>
        {recordId ? (
          <Button
            variant="quiet"
            type="button"
            onClick={() => {
              setParams({});
              setSearch('');
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
          title="Chọn bệnh án"
          path="/medical_records"
          listPath="/medical_records/all"
          fields={[]}
          paginated
          canCreate={false}
          canEdit={false}
          canDelete={false}
          columns={[
            { key: 'medical_record_id', label: 'MÃ BỆNH ÁN' },
            { key: 'patient_id', label: 'MÃ BỆNH NHÂN' },
            { key: 'template_id', label: 'MẪU PHIẾU' },
            {
              key: 'status',
              label: 'TRẠNG THÁI',
              render: (row: Row) =>
                row.status === 'pending'
                  ? 'Chờ tiếp nhận'
                  : row.status === 'in_progress'
                    ? 'Đang khám'
                    : 'Đã hoàn tất',
            },
          ]}
          actions={(row) => (
            <Button
              variant="quiet"
              size="small"
              onClick={() => {
                const id = String(row.medical_record_id);
                setSearch(id);
                setParams({ record: id });
              }}
            >
              Mở
            </Button>
          )}
        />
      )}
    </>
  );
}
