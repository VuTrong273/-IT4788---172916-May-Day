import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { useApi, type Row } from './api';
import { Alert, Editor, ResourcePanel } from './shared';
import { patientFields } from './fields';
import { UserDetails } from './UsersPage';

export function PatientsPage() {
  const api = useApi();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  return (
    <>
      <PageHeader
        eyebrow="TIẾP NHẬN NGƯỜI BỆNH"
        title="Bệnh nhân"
        description="Tìm người bệnh theo số điện thoại hoặc họ tên trước khi tạo hồ sơ mới."
        actions={
          <Button onClick={() => setCreating(true)}>Tạo hồ sơ bệnh nhân</Button>
        }
      />
      <Panel title="Tìm bệnh nhân">
        <form
          className="ops-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            if (!phone.trim() && !name.trim()) {
              setError('Nhập số điện thoại hoặc họ tên để tìm kiếm.');
              return;
            }
            setError('');
            const params = new URLSearchParams();
            if (phone.trim()) params.set('phone', phone.trim());
            if (name.trim()) params.set('full_name', name.trim());
            setQuery(params.toString());
          }}
        >
          <label className="ops-filter">
            Số điện thoại
            <input
              type="tel"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="ops-filter">
            Họ tên
            <input
              value={name}
              maxLength={150}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit">Tìm kiếm</Button>
        </form>
        <Alert>{error}</Alert>
      </Panel>
      <Alert success>{notice}</Alert>
      {query ? (
        <ResourcePanel
          key={query}
          title="Kết quả tìm kiếm"
          path="/doctor/patients"
          listPath={`/doctor/patients/search?${query}`}
          fields={[]}
          paginated
          canCreate={false}
          canEdit={false}
          canDelete={false}
          refreshKey={revision}
          columns={[
            { key: 'full_name', label: 'HỌ TÊN' },
            { key: 'phone', label: 'ĐIỆN THOẠI' },
            { key: 'year_of_birth', label: 'NĂM SINH' },
          ]}
          actions={(row) => (
            <Button variant="quiet" size="small" onClick={() => setDetail(row)}>
              Xem hồ sơ
            </Button>
          )}
        />
      ) : (
        <div className="ops-state">Kết quả tìm kiếm sẽ xuất hiện tại đây.</div>
      )}
      {creating ? (
        <Editor
          title="Tạo hồ sơ bệnh nhân"
          fields={patientFields}
          onClose={() => setCreating(false)}
          onSave={async (body) => {
            const created = await api<Row>('/doctor/patients', 'POST', body);
            setPhone(String(created.data.phone));
            setName('');
            setQuery(
              new URLSearchParams({
                phone: String(created.data.phone),
              }).toString(),
            );
            setRevision((v) => v + 1);
            setNotice(`Đã tạo hồ sơ cho ${String(created.data.full_name)}.`);
          }}
        />
      ) : null}
      {detail ? (
        <UserDetails row={detail} onClose={() => setDetail(null)} />
      ) : null}
    </>
  );
}
