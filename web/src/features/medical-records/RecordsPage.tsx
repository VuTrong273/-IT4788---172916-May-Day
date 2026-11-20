import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const searchRef = useRef<HTMLInputElement>(null);
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
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !target.closest('input, textarea, select, [contenteditable="true"]')) { event.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const visibleRecords = useMemo(() => records.filter((record) => {
    const query = search.trim().toLowerCase();
    return !query || String(record.medical_record_id).includes(query) || String(record.patient_id).includes(query) || record.template_id.toLowerCase().includes(query);
  }), [records, search]);

  const columns: DataColumn<MedicalRecord>[] = [
    { key: 'record', header: 'BỆNH ÁN', render: (record) => <Link className="records-record-link" to={`/app/records/${record.medical_record_id}`}><span className="records-file-icon"><Icon name="records" size={19} /></span><span><strong>#{record.medical_record_id}</strong><small>Mã bệnh án</small></span></Link> },
    { key: 'patient', header: 'BỆNH NHÂN', render: (record) => <span className="records-patient-cell"><span className="records-patient-avatar">BN</span><span><strong>Bệnh nhân #{record.patient_id}</strong></span></span> },
    { key: 'template', header: 'MẪU PHIẾU', render: (record) => <span className="template-chip">{record.template_id}</span> },
    { key: 'created', header: 'NGÀY TẠO', render: (record) => <span className="records-date"><strong>{new Date(record.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong><small>{new Date(record.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</small></span> },
    { key: 'status', header: 'TRẠNG THÁI', render: (record) => <StatusBadge status={record.status} /> },
    { key: 'action', header: '', className: 'data-table__action', render: (record) => <Link className="records-open" aria-label={`Mở bệnh án ${record.medical_record_id}`} to={`/app/records/${record.medical_record_id}`}>Xem hồ sơ<Icon name="arrow" size={15} /></Link> },
  ];

  function chooseStatus(value: RecordStatus | 'all') {
    setPage(1);
    setSearch('');
    setSearchParams(value === 'all' ? {} : { status: value });
  }

  const maxPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="records-page">
      <PageHeader eyebrow="QUẢN LÝ KHÁM BỆNH" title="Bệnh án" description="Tra cứu hồ sơ và theo dõi tiến trình khám bệnh." actions={<Button variant="secondary" disabled={loading} icon={<Icon name="refresh" size={16} />} onClick={() => void load()}>{loading ? 'Đang tải…' : 'Làm mới'}</Button>} />
      <Panel className="records-panel">
        <div className="records-panel-heading"><div><span className="records-heading-icon"><Icon name="clipboard" size={21} /></span><h2>Danh sách bệnh án</h2><span className="records-total">{loading ? '…' : total.toLocaleString('vi-VN')} hồ sơ</span></div><span className="records-scope"><Icon name="shield" size={14} />Theo quyền truy cập của bạn</span></div>
        <div className="records-toolbar">
          <div className="filter-tabs" role="group" aria-label="Lọc theo trạng thái">{tabs.map((tab) => <button type="button" aria-pressed={status === tab.value} className={`filter-tab filter-tab--${tab.value}${status === tab.value ? ' filter-tab--active' : ''}`} key={tab.value} onClick={() => chooseStatus(tab.value)}>{tab.value !== 'all' ? <i aria-hidden="true" /> : null}{tab.label}</button>)}</div>
          <label className="table-search"><Icon name="search" size={17} /><input ref={searchRef} aria-label="Tìm theo mã bệnh án, bệnh nhân hoặc mẫu trong trang hiện tại" placeholder="Tìm mã bệnh án, bệnh nhân…" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setSearch(''); }} />{search ? <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setSearch(''); searchRef.current?.focus(); }}><Icon name="close" size={15} /></button> : <kbd>/</kbd>}</label>
        </div>
        {search ? <p className="records-search-caption">{visibleRecords.length} kết quả trong {records.length} hồ sơ của trang hiện tại.</p> : null}
        {error ? <div className="records-empty"><EmptyState icon="alert" title="Không thể tải bệnh án" description={error} action={<Button variant="secondary" onClick={() => void load()}>Thử lại</Button>} /></div> : loading ? <div className="table-loading"><span /><span /><span /><span /></div> : visibleRecords.length ? <DataTable rows={visibleRecords} columns={columns} rowKey={(record) => record.medical_record_id} /> : <div className="records-empty"><EmptyState icon="records" title={search ? 'Không tìm thấy kết quả' : 'Chưa có bệnh án'} description={search ? 'Thử tìm với mã bệnh án, mã bệnh nhân hoặc mẫu phiếu khác.' : 'Khi có hồ sơ phù hợp, danh sách sẽ được cập nhật tại đây.'} action={search ? <Button size="small" variant="quiet" onClick={() => setSearch('')}>Xóa tìm kiếm</Button> : undefined} /></div>}
        <div className="table-footer"><span>{search ? `Hiển thị ${visibleRecords.length} kết quả trên trang ${page}` : <>Hiển thị {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} trong {total.toLocaleString('vi-VN')} hồ sơ</>}</span><div className="pagination"><button className="pagination__button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><Icon name="chevron" size={15} className="pagination__previous" />Trước</button><span>Trang <strong>{page}</strong> / {maxPages}</span><button className="pagination__button" disabled={page >= maxPages || loading} onClick={() => setPage((current) => current + 1)}>Sau<Icon name="chevron" size={15} /></button></div></div>
      </Panel>
    </div>
  );
}
