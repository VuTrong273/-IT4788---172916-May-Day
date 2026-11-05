import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Button } from '@/components/ui/button';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/features/auth/auth-context';
import { listMedicalRecords, type MedicalRecord, type RecordStatus } from './medical-records-api';

const tabs: { label: string; value: RecordStatus | 'all' }[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Chờ tiếp nhận', value: 'pending' },
  { label: 'Đang khám', value: 'in_progress' },
  { label: 'Đã hoàn tất', value: 'completed' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function RecordsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusValue = searchParams.get('status');
  const status: RecordStatus | 'all' = ['pending', 'in_progress', 'completed'].includes(statusValue ?? '') ? statusValue as RecordStatus : 'all';
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const result = await listMedicalRecords(session, { page, limit: pageSize, status: status === 'all' ? undefined : status });
      setRecords(result.data);
      setTotal(result.total);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không tải được danh sách bệnh án.');
    } finally {
      setLoading(false);
    }
  }, [session, page, status]);

  useEffect(() => { void load(); }, [load]);

  const visibleRecords = useMemo(() => records.filter((record) => {
    const query = search.trim().toLowerCase();
    return !query || String(record.medical_record_id).includes(query) || String(record.patient_id).includes(query) || record.template_id.toLowerCase().includes(query);
  }), [records, search]);

  const columns: DataColumn<MedicalRecord>[] = [
    { key: 'record', header: 'MÃ BỆNH ÁN', render: (record) => <Link className="table-primary-link" to={`/app/records/${record.medical_record_id}`}>#{record.medical_record_id}</Link> },
    { key: 'patient', header: 'BỆNH NHÂN', render: (record) => <span className="table-main-cell">Bệnh nhân #{record.patient_id}</span> },
    { key: 'template', header: 'MẪU PHIẾU', render: (record) => <span className="template-chip">{record.template_id}</span> },
    { key: 'created', header: 'NGÀY TẠO', render: (record) => <span className="table-muted-cell">{formatDate(record.created_at)}</span> },
    { key: 'status', header: 'TRẠNG THÁI', render: (record) => <StatusBadge status={record.status} /> },
    { key: 'action', header: '', className: 'data-table__action', render: (record) => <Link className="icon-button table-action" aria-label={`Mở bệnh án ${record.medical_record_id}`} to={`/app/records/${record.medical_record_id}`}><Icon name="chevron" size={17} /></Link> },
  ];

  function chooseStatus(value: RecordStatus | 'all') {
    setPage(1);
    setSearchParams(value === 'all' ? {} : { status: value });
  }

  const maxPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader eyebrow="QUẢN LÝ KHÁM BỆNH" title="Bệnh án" description="Theo dõi hồ sơ theo trạng thái và tiếp tục các lượt khám đang xử lý." actions={<Button variant="secondary" icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>Làm mới</Button>} />
      <div className="records-summary-strip"><span className="records-summary-strip__icon"><Icon name="records" size={19} /></span><span><strong>{total.toLocaleString('vi-VN')}</strong><small>hồ sơ trong danh sách này</small></span><span className="records-summary-strip__scope"><Icon name="shield" size={15} /> Theo phạm vi tài khoản</span></div>
      <Panel className="records-panel">
        <div className="records-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="Lọc theo trạng thái">{tabs.map((tab) => <button type="button" role="tab" aria-selected={status === tab.value} className={`filter-tab${status === tab.value ? ' filter-tab--active' : ''}`} key={tab.value} onClick={() => chooseStatus(tab.value)}>{tab.label}{status === tab.value ? <span>{total}</span> : null}</button>)}</div>
          <label className="table-search"><Icon name="search" size={17} /><input aria-label="Tìm theo mã bệnh án, bệnh nhân hoặc mẫu" placeholder="Tìm trong trang hiện tại" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></label>
        </div>
        {error ? <div className="records-empty"><EmptyState icon="alert" title="Không thể tải bệnh án" description={error} action={<Button variant="secondary" onClick={() => void load()}>Thử lại</Button>} /></div> : loading ? <div className="table-loading"><span /><span /><span /><span /></div> : visibleRecords.length ? <DataTable rows={visibleRecords} columns={columns} rowKey={(record) => record.medical_record_id} /> : <div className="records-empty"><EmptyState icon="records" title={search ? 'Không tìm thấy kết quả' : 'Chưa có bệnh án'} description={search ? 'Thử tìm với mã bệnh án, mã bệnh nhân hoặc mẫu phiếu khác.' : 'Khi có hồ sơ phù hợp, danh sách sẽ được cập nhật tại đây.'} action={search ? <Button size="small" variant="quiet" onClick={() => setSearch('')}>Xóa tìm kiếm</Button> : undefined} /></div>}
        <div className="table-footer"><span>Hiển thị {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} trong {total.toLocaleString('vi-VN')} hồ sơ</span><div className="pagination"><button className="pagination__button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><Icon name="chevron" size={15} className="pagination__previous" />Trước</button><span>Trang <strong>{page}</strong> / {maxPages}</span><button className="pagination__button" disabled={page >= maxPages || loading} onClick={() => setPage((current) => current + 1)}>Sau<Icon name="chevron" size={15} /></button></div></div>
      </Panel>
    </>
  );
}
