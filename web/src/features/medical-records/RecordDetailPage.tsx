import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/features/auth/auth-context';
import { roleFromId } from '@/features/auth/auth-types';
import { acceptMedicalRecord, getMedicalRecord, type MedicalRecordDetail, type MedicalRecordSummary } from './medical-records-api';

function formatDate(value: string | null) {
  if (!value) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
}

export function RecordDetailPage() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const { session } = useAuth();
  const [record, setRecord] = useState<MedicalRecordDetail | null>(null);
  const [summary, setSummary] = useState<MedicalRecordSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const role = session ? roleFromId(session.user.role_id) : null;

  const load = useCallback(async () => {
    if (!session || !Number.isSafeInteger(id) || id < 1) {
      setError('Mã bệnh án không hợp lệ.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const detail = await getMedicalRecord(session, id);
      setRecord(detail.record);
      setSummary(detail.summary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải bệnh án.');
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => { void load(); }, [load]);

  async function accept() {
    if (!session || !record || saving) return;
    setSaving(true);
    setError('');
    try {
      await acceptMedicalRecord(session, record.medical_record_id);
      setConfirm(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tiếp nhận được bệnh án.');
    } finally {
      setSaving(false);
    }
  }

  const canAccept = role === 'doctor' && record?.status === 'pending' && record.assigned_doctor_id === null;

  return (
    <>
      <div className="detail-back"><Link to="/app/records"><Icon name="arrow" size={16} className="back-arrow" />Quay lại danh sách bệnh án</Link></div>
      <PageHeader eyebrow="HỒ SƠ KHÁM BỆNH" title={`Bệnh án #${rawId ?? ''}`} description="Thông tin bệnh án được tải từ hệ thống May Day." actions={record ? <StatusBadge status={record.status} /> : undefined} />
      {error ? <div className="form-alert page-alert" role="alert"><Icon name="alert" size={18} />{error}<button onClick={() => void load()}>Tải lại</button></div> : null}
      {loading ? <div className="detail-skeleton"><span /><span /><span /></div> : record ? (
        <div className="detail-grid">
          <div className="detail-main-column">
            <Panel title="Thông tin hồ sơ" className="detail-panel">
              <div className="detail-patient"><span className="detail-patient__avatar"><Icon name="patient" size={24} /></span><span><small>BỆNH NHÂN</small><strong>{summary?.patient_name || `Bệnh nhân #${record.patient_id}`}</strong><em>Mã hồ sơ bệnh nhân: {record.patient_id}</em></span></div>
              <div className="detail-divider" />
              <div className="detail-fields">
                <div><span className="detail-label">Mã bệnh án</span><strong>#{record.medical_record_id}</strong></div>
                <div><span className="detail-label">Mẫu phiếu</span><strong>{record.template_id}</strong></div>
                <div><span className="detail-label">Ngày tạo</span><strong>{formatDate(record.created_at)}</strong></div>
                <div><span className="detail-label">Cập nhật gần nhất</span><strong>{formatDate(record.updated_at)}</strong></div>
                <div><span className="detail-label">Bác sĩ phụ trách</span><strong>{record.assigned_doctor_id ? `Nhân viên #${record.assigned_doctor_id}` : 'Chưa được phân công'}</strong></div>
                <div><span className="detail-label">Hoàn tất lúc</span><strong>{formatDate(record.completed_at)}</strong></div>
              </div>
            </Panel>
            <Panel title="Lời dặn và ghi chú" className="detail-panel">
              {record.instructions ? <p className="record-instructions">{record.instructions}</p> : <p className="muted-copy">Chưa có lời dặn cho hồ sơ này.</p>}
            </Panel>
            {record.status === 'in_progress' ? <Panel className="feature-notice"><div className="feature-notice__icon"><Icon name="activity" /></div><div><strong>Hồ sơ đang được xử lý</strong><p>Đặc tả OpenAPI có luồng trả lời phiếu khám, chỉ định xét nghiệm và kê đơn. Giao diện chưa tích hợp các luồng này; backend hiện tại cũng chưa có route tương ứng để bật thao tác.</p></div></Panel> : null}
          </div>
          <aside className="detail-side-column">
            <Panel title="Tình trạng hồ sơ" className="status-panel"><StatusBadge status={record.status} /><p>{record.status === 'pending' ? 'Hồ sơ đang chờ bác sĩ tiếp nhận.' : record.status === 'in_progress' ? 'Bệnh án đã được bác sĩ tiếp nhận.' : 'Quy trình của hồ sơ đã hoàn tất.'}</p><div className="status-panel__date"><Icon name="calendar" size={16} />Tạo ngày {formatDate(record.created_at)}</div></Panel>
            {canAccept ? <Panel title="Hành động" className="accept-panel"><p>Tiếp nhận hồ sơ sẽ giao bệnh án này cho bạn và chuyển trạng thái sang đang khám.</p>{confirm ? <div className="confirm-box"><strong>Xác nhận tiếp nhận hồ sơ #{id}?</strong><div><Button onClick={() => void accept()} disabled={saving}>{saving ? 'Đang xử lý…' : 'Xác nhận'}</Button><Button variant="quiet" onClick={() => setConfirm(false)} disabled={saving}>Hủy</Button></div></div> : <Button icon={<Icon name="check" size={17} />} onClick={() => setConfirm(true)}>Tiếp nhận bệnh án</Button>}</Panel> : null}
            <Panel className="privacy-card"><div className="privacy-card__mark"><Icon name="shield" /></div><strong>Quyền riêng tư</strong><p>Thông tin bệnh nhân chỉ được hiển thị theo phân quyền của tài khoản.</p></Panel>
          </aside>
        </div>
      ) : !error ? <div className="detail-empty">Không tìm thấy bệnh án.</div> : null}
    </>
  );
}
