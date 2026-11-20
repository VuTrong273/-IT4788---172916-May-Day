import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/features/auth/auth-context";
import { roleFromId } from "@/features/auth/auth-types";
import {
  acceptMedicalRecord,
  getMedicalRecord,
  type MedicalRecordDetail,
  type MedicalRecordSummary,
} from "./medical-records-api";
import { ClinicalRecord } from "@/features/operations/ClinicalPage";
import { RecordForm } from "./RecordForm";
import { RecordMonitoring } from "./RecordMonitoring";
import { useApi } from "@/features/operations/api";

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RecordDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const { session, can } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [record, setRecord] = useState<MedicalRecordDetail | null>(null);
  const [summary, setSummary] = useState<MedicalRecordSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const role = session ? roleFromId(session.user) : null;

  const load = useCallback(async () => {
    if (!session || !Number.isSafeInteger(id) || id < 1) {
      setError("Mã bệnh án không hợp lệ.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const detail = await getMedicalRecord(session, id, can('GET', `/medical_records/${id}/summary`));
      setRecord(detail.record);
      setSummary(detail.summary);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Không thể tải bệnh án.",
      );
    } finally {
      setLoading(false);
    }
  }, [id, session, can]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept() {
    if (!session || !record || saving) return;
    setSaving(true);
    setError("");
    try {
      await acceptMedicalRecord(session, record.medical_record_id);
      setConfirm(false);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không tiếp nhận được bệnh án.",
      );
    } finally {
      setSaving(false);
    }
  }

  const canAccept =
    can('POST', `/medical_records/${id}/accept`) &&
    role === "doctor" &&
    record?.status === "pending" &&
    record.assigned_doctor_id === null;

  const canViewForm = !!record && can('GET', `/medical_records/${id}/answers`) &&
    can('GET', `/templates/${record.template_id}`);
  const canViewMonitoring = !!record && (role === "admin" ||
    record.assigned_doctor_id === session?.user.user_id);
  const sections: { id: string; label: string; icon: IconName }[] = [
    { id: "overview", label: "Tổng quan", icon: "dashboard" },
    { id: "clinical", label: "Khám & điều trị", icon: "activity" },
    ...(canViewForm ? [{ id: "form", label: "Phiếu khám", icon: "clipboard" as const }] : []),
    ...(canViewMonitoring ? [{ id: "monitoring", label: "Theo dõi tại nhà", icon: "chart" as const }] : []),
  ];
  const selectedSection = sections.some((section) => section.id === activeSection)
    ? activeSection : "overview";

  return (
    <div className="record-detail-page">
      <div className="detail-back">
        <Link to="/app/records">
          <Icon name="arrow" size={16} className="back-arrow" />
          Quay lại danh sách bệnh án
        </Link>
      </div>
      {!record ? <h1 className="record-loading-title">Bệnh án #{rawId ?? ""}</h1> : null}
      {error ? (
        <div className="form-alert page-alert" role="alert">
          <Icon name="alert" size={18} />
          {error}
          <button onClick={() => void load()}>Tải lại</button>
        </div>
      ) : null}
      {loading ? (
        <div className="detail-skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : record ? (
        <>
        <section className="record-identity" aria-label="Thông tin bệnh nhân">
          <div className="record-identity__patient">
            <div className="record-identity__copy">
              <h1>Bệnh án #{record.medical_record_id}</h1>
              <span className="record-identity__name">{summary?.patient_name || `Bệnh nhân #${record.patient_id}`}</span>
              <span className="record-identity__patient-id">BN #{record.patient_id}</span>
            </div>
          </div>
          <div className="record-identity__meta">
            <StatusBadge status={record.status} />
            <span><Icon name="user" size={14} />{record.assigned_doctor_id ? `Bác sĩ phụ trách · #${record.assigned_doctor_id}` : "Chưa phân công bác sĩ"}</span>
          </div>
        </section>
        <div className="detail-grid">
          <div className="detail-main-column">
            <div className="record-navigation" role="tablist" aria-label="Nội dung bệnh án">
              {sections.map((section) => (
                <button
                  key={section.id}
                  id={`record-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selectedSection === section.id}
                  aria-controls={`record-section-${section.id}`}
                  tabIndex={selectedSection === section.id ? 0 : -1}
                  onClick={() => setActiveSection(section.id)}
                  onKeyDown={(event) => {
                    const current = sections.findIndex((item) => item.id === section.id);
                    let next = current;
                    if (event.key === "ArrowRight") next = (current + 1) % sections.length;
                    else if (event.key === "ArrowLeft") next = (current - 1 + sections.length) % sections.length;
                    else if (event.key === "Home") next = 0;
                    else if (event.key === "End") next = sections.length - 1;
                    else return;
                    event.preventDefault();
                    setActiveSection(sections[next].id);
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                  }}
                ><Icon name={section.icon} size={17} />{section.label}</button>
              ))}
            </div>
            <div id="record-section-overview" role="tabpanel" aria-labelledby="record-tab-overview" hidden={selectedSection !== "overview"} className="record-section">
            <Panel title="Thông tin hồ sơ" className="detail-panel">
              <div className="detail-fields">
                <div>
                  <span className="detail-label">Mã bệnh án</span>
                  <strong>#{record.medical_record_id}</strong>
                </div>
                <div>
                  <span className="detail-label">Mẫu phiếu</span>
                  <strong>{record.template_id}</strong>
                </div>
                <div>
                  <span className="detail-label">Ngày tạo</span>
                  <strong>{formatDate(record.created_at)}</strong>
                </div>
                <div>
                  <span className="detail-label">Cập nhật gần nhất</span>
                  <strong>{formatDate(record.updated_at)}</strong>
                </div>
                <div>
                  <span className="detail-label">Bác sĩ phụ trách</span>
                  <strong>
                    {record.assigned_doctor_id
                      ? `Nhân viên #${record.assigned_doctor_id}`
                      : "Chưa được phân công"}
                  </strong>
                </div>
                <div>
                  <span className="detail-label">Hoàn tất lúc</span>
                  <strong>{formatDate(record.completed_at)}</strong>
                </div>
              </div>
            </Panel>
            <Panel title="Lời dặn và ghi chú" className="detail-panel">
              {record.instructions ? (
                <p className="record-instructions">{record.instructions}</p>
              ) : (
                <div className="record-note-empty"><Icon name="clipboard" size={20} /><p>Chưa có lời dặn cho hồ sơ này.<small>Lời dặn của bác sĩ sẽ được hiển thị tại đây.</small></p></div>
              )}
            </Panel>
            </div>
            <div id="record-section-clinical" role="tabpanel" aria-labelledby="record-tab-clinical" hidden={selectedSection !== "clinical"} className="record-section">
            <ClinicalRecord key={record.medical_record_id} record={record} />
            </div>
            {canViewForm ? <div id="record-section-form" role="tabpanel" aria-labelledby="record-tab-form" hidden={selectedSection !== "form"} className="record-section"><RecordForm
              record={record}
              canEdit={
                role === "doctor" &&
                record.assigned_doctor_id === session?.user.user_id &&
                record.status === "in_progress"
              }
              onChanged={load}
            /></div> : null}
            {canViewMonitoring ? (
              <div id="record-section-monitoring" role="tabpanel" aria-labelledby="record-tab-monitoring" hidden={selectedSection !== "monitoring"} className="record-section">
              <RecordMonitoring
                record={record}
                canManage={
                  can('PUT', `/medical_records/${id}`) && role === "doctor" &&
                  record.assigned_doctor_id === session?.user.user_id
                }
                onChanged={load}
              />
              </div>
            ) : null}
          </div>
          <aside className="detail-side-column">
            {role === "admin" && can('DELETE', `/medical_records/${id}`) ? (
              <Panel title="Quản lý bệnh án">
                {confirmDelete ? (
                  <div className="confirm-box">
                    <p>
                      Xóa bệnh án #{record.medical_record_id} cùng dữ liệu khám
                      và theo dõi liên quan?
                    </p>
                    <Button
                      disabled={saving}
                      onClick={() => {
                        setSaving(true);
                        void api(
                          `/medical_records/${record.medical_record_id}`,
                          "DELETE",
                        )
                          .then(() =>
                            navigate("/app/records", { replace: true }),
                          )
                          .catch((reason) =>
                            setError(
                              reason instanceof Error
                                ? reason.message
                                : "Không xóa được bệnh án.",
                            ),
                          )
                          .finally(() => setSaving(false));
                      }}
                    >
                      Xác nhận xóa
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Hủy
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="quiet"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Xóa bệnh án
                  </Button>
                )}
              </Panel>
            ) : null}
            <Panel title="Tiến trình hồ sơ" className="status-panel">
              <p>
                {record.status === "pending"
                  ? "Hồ sơ đang chờ bác sĩ tiếp nhận."
                  : record.status === "in_progress"
                    ? "Bệnh án đã được bác sĩ tiếp nhận."
                    : "Quy trình của hồ sơ đã hoàn tất."}
              </p>
              <ol className="record-progress">
                <li className="is-done"><span><Icon name="check" size={12} /></span><div><strong>Tạo hồ sơ</strong><small>{formatDate(record.created_at)}</small></div></li>
                <li className={record.status !== "pending" ? "is-done" : ""}><span><Icon name={record.status !== "pending" ? "check" : "clock"} size={12} /></span><div><strong>Khám & điều trị</strong><small>{record.status === "pending" ? "Chờ bác sĩ tiếp nhận" : "Đã tiếp nhận hồ sơ"}</small></div></li>
                <li className={record.completed_at ? "is-done" : ""}><span><Icon name={record.completed_at ? "check" : "clock"} size={12} /></span><div><strong>Hoàn tất khám</strong><small>{record.completed_at ? formatDate(record.completed_at) : "Chờ hoàn tất phiếu khám"}</small></div></li>
              </ol>
            </Panel>
            {canAccept ? (
              <Panel title="Hành động" className="accept-panel">
                <p>
                  Tiếp nhận hồ sơ sẽ giao bệnh án này cho bạn và chuyển trạng
                  thái sang đang khám.
                </p>
                {confirm ? (
                  <div className="confirm-box">
                    <strong>Xác nhận tiếp nhận hồ sơ #{id}?</strong>
                    <div>
                      <Button onClick={() => void accept()} disabled={saving}>
                        {saving ? "Đang xử lý…" : "Xác nhận"}
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => setConfirm(false)}
                        disabled={saving}
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    icon={<Icon name="check" size={17} />}
                    onClick={() => setConfirm(true)}
                  >
                    Tiếp nhận bệnh án
                  </Button>
                )}
              </Panel>
            ) : null}
            <Panel className="privacy-card">
              <div className="privacy-card__mark">
                <Icon name="shield" />
              </div>
              <strong>Quyền riêng tư</strong>
              <p>
                Thông tin bệnh nhân chỉ được hiển thị theo phân quyền của tài
                khoản.
              </p>
            </Panel>
          </aside>
        </div>
        </>
      ) : !error ? (
        <div className="detail-empty">Không tìm thấy bệnh án.</div>
      ) : null}
    </div>
  );
}
