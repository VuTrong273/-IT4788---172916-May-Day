import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/features/auth/auth-context';
import { roleFromId } from '@/features/auth/auth-types';
import { listMedicalRecords, type MedicalRecord } from '@/features/medical-records/medical-records-api';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function DashboardPage() {
  const { session } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [recent, setRecent] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const role = session ? roleFromId(session.user.role_id) : null;
  const firstName = session?.user.full_name.trim().split(/\s+/).at(-1) ?? 'bạn';

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const [pending, active, completed] = await Promise.all([
        listMedicalRecords(session, { status: 'pending', limit: 5 }),
        listMedicalRecords(session, { status: 'in_progress', limit: 5 }),
        listMedicalRecords(session, { status: 'completed', limit: 1 }),
      ]);
      setPendingCount(pending.total);
      setActiveCount(active.total);
      setCompletedCount(completed.total);
      setRecent([...pending.data, ...active.data]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không thể tải dữ liệu tổng quan.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);

  const statCards = [
    { label: 'Chờ tiếp nhận', value: pendingCount, icon: 'clock' as const, tone: 'amber', note: 'Bệnh án mới gửi' },
    { label: 'Đang khám', value: activeCount, icon: 'activity' as const, tone: 'green', note: 'Đang được xử lý' },
    { label: 'Đã hoàn tất', value: completedCount, icon: 'check' as const, tone: 'blue', note: 'Tổng hồ sơ hoàn tất' },
    { label: 'Tổng hồ sơ', value: pendingCount + activeCount + completedCount, icon: 'records' as const, tone: 'purple', note: 'Theo dữ liệu backend' },
  ];

  return (
    <>
      <PageHeader eyebrow="TỔNG QUAN" title={`Xin chào, ${firstName}`} description="Theo dõi công việc và tình hình bệnh án tại May Day." actions={<Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>Làm mới</Button>} />
      <div className="dashboard-banner">
        <div className="dashboard-banner__copy"><span className="dashboard-banner__eyebrow">MAY DAY · KHÔNG GIAN Y TẾ</span><h2>Chăm sóc tốt hơn, bắt đầu từ đây.</h2><p>{role === 'admin' ? 'Quản lý hệ thống và theo dõi quy trình chăm sóc trên cùng một không gian.' : 'Các bệnh án được sắp xếp theo trạng thái để bạn dễ dàng tiếp tục công việc.'}</p><Link to="/app/records" className="banner-link">Mở danh sách bệnh án <Icon name="arrow" size={16} /></Link></div>
        <div className="dashboard-banner__art" aria-hidden="true"><div className="banner-orbit banner-orbit--outer" /><div className="banner-orbit banner-orbit--inner" /><div className="banner-cross"><span /><span /></div><div className="banner-caption"><Icon name="activity" size={16} /> Sức khỏe là ưu tiên</div></div>
      </div>

      <div className="section-heading"><div><h2>Tình hình bệnh án</h2><p>Số liệu cập nhật trực tiếp từ hệ thống.</p></div><span className="live-label"><span />Đang kết nối</span></div>
      {error ? <div className="form-alert page-alert" role="alert"><Icon name="alert" size={18} />{error}</div> : null}
      <div className="stat-grid">
        {statCards.map((item) => <article className="stat-card" key={item.label}><div className={`stat-card__icon stat-card__icon--${item.tone}`}><Icon name={item.icon} size={19} /></div><span className="stat-card__label">{item.label}</span><strong className="stat-card__value">{loading ? <span className="value-skeleton" /> : item.value.toLocaleString('vi-VN')}</strong><span className="stat-card__note">{item.note}</span></article>)}
      </div>

      <div className="dashboard-grid">
        <Panel title="Bệnh án cần chú ý" action={<Link className="panel-link" to="/app/records">Xem tất cả <Icon name="arrow" size={15} /></Link>}>
          {error ? <EmptyState icon="alert" title="Chưa tải được danh sách" description="Kiểm tra kết nối backend hoặc thử tải lại." action={<Button size="small" variant="secondary" onClick={() => void load()}>Thử lại</Button>} /> : loading ? <div className="table-loading"><span /><span /><span /></div> : recent.length ? (
            <div className="record-preview-list">
              {recent.map((record) => <Link className="record-preview" to={`/app/records/${record.medical_record_id}`} key={record.medical_record_id}><span className="record-preview__icon"><Icon name="records" size={18} /></span><span className="record-preview__copy"><strong>Bệnh án #{record.medical_record_id}</strong><small>Bệnh nhân #{record.patient_id} · Mẫu {record.template_id}</small></span><StatusBadge status={record.status} /><span className="record-preview__date">{formatDate(record.created_at)}</span><Icon name="chevron" size={16} className="record-preview__arrow" /></Link>)}
            </div>
          ) : <EmptyState icon="records" title="Chưa có bệnh án cần xử lý" description="Khi có hồ sơ mới, danh sách sẽ xuất hiện tại đây." />}
        </Panel>
        <Panel title="Lối tắt công việc">
          <div className="shortcut-list">
            <Link to="/app/records?status=pending" className="shortcut"><span className="shortcut__icon shortcut__icon--amber"><Icon name="clock" /></span><span><strong>Tiếp nhận bệnh án</strong><small>{loading ? 'Đang cập nhật…' : `${pendingCount} hồ sơ đang chờ`}</small></span><Icon name="chevron" size={17} /></Link>
            <Link to="/app/records?status=in_progress" className="shortcut"><span className="shortcut__icon shortcut__icon--green"><Icon name="activity" /></span><span><strong>Tiếp tục thăm khám</strong><small>{loading ? 'Đang cập nhật…' : `${activeCount} hồ sơ đang khám`}</small></span><Icon name="chevron" size={17} /></Link>
            <Link to="/app/profile" className="shortcut"><span className="shortcut__icon shortcut__icon--slate"><Icon name="user" /></span><span><strong>Hồ sơ tài khoản</strong><small>Thông tin và bảo mật</small></span><Icon name="chevron" size={17} /></Link>
          </div>
          <div className="privacy-note"><Icon name="shield" size={17} /><span>Chỉ xem hồ sơ trong phạm vi quyền truy cập được cấp.</span></div>
        </Panel>
      </div>
    </>
  );
}
