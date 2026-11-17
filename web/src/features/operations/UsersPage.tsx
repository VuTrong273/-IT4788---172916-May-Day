import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/features/auth/auth-context';
import { label, rowId, useApi, useData, type Row } from './api';
import {
  Alert,
  choices,
  Editor,
  Modal,
  ResourcePanel,
  type Field,
} from './shared';
import { accountFields, patientFields } from './fields';

export function UserDetails({
  row,
  onClose,
  path,
}: {
  row: Row;
  onClose: () => void;
  path?: string;
}) {
  const detail = useData<Row>(path ?? null, row);
  const fields = [
    ...patientFields.filter((field) => field.name !== 'password'),
    { name: 'user_id', label: 'Mã tài khoản' },
    { name: 'branch_id', label: 'Mã chi nhánh' },
    { name: 'department_id', label: 'Mã khoa' },
    { name: 'room_id', label: 'Mã phòng' },
  ];
  return (
    <Modal title="Thông tin tài khoản" onClose={onClose}>
      <div className="ops-form">
        <Alert>{detail.error}</Alert>
        {detail.loading ? (
          <p role="status">Đang tải hồ sơ…</p>
        ) : (
          <dl className="ops-details">
            {fields
              .filter(
                (field) =>
                  detail.data[field.name] !== null &&
                  detail.data[field.name] !== undefined,
              )
              .map((field) => (
                <div key={field.name}>
                  <dt>{field.label}</dt>
                  <dd>
                    {field.name === 'gender'
                      ? ({ male: 'Nam', female: 'Nữ', other: 'Khác' }[
                          String(detail.data.gender)
                        ] ?? '—')
                      : label(detail.data[field.name])}
                  </dd>
                </div>
              ))}
          </dl>
        )}
      </div>
    </Modal>
  );
}

export function UsersPage() {
  const { session } = useAuth();
  const api = useApi();
  const [revision, setRevision] = useState(0);
  const roles = useData<Row[]>('/roles', []);
  const branches = useData<Row[]>('/branches', []);
  const departments = useData<Row[]>('/departments', []);
  const rooms = useData<Row[]>('/rooms', []);
  const [staff, setStaff] = useState(false);
  const [assign, setAssign] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const roleName = (id: unknown) =>
    label(roles.data.find((r) => r.id === id)?.name);
  const roleField: Field = {
    name: 'role_id',
    label: 'Vai trò',
    type: 'select',
    numeric: true,
    required: true,
    choices: choices(roles.data),
  };
  const assignmentFields: Field[] = [
    {
      name: 'branch_id',
      label: 'Chi nhánh',
      type: 'select',
      required: true,
      numeric: true,
      choices: choices(branches.data),
    },
    {
      name: 'department_id',
      label: 'Khoa',
      type: 'select',
      required: true,
      numeric: true,
      dependsOn: 'branch_id',
      choices: departments.data.map((r) => ({
        value: String(r.id),
        label: String(r.name),
        parent: String(r.branch_id),
      })),
    },
    {
      name: 'room_id',
      label: 'Phòng',
      type: 'select',
      numeric: true,
      nullable: true,
      dependsOn: 'department_id',
      choices: rooms.data.map((r) => ({
        value: String(r.id),
        label: String(r.name),
        parent: String(r.department_id),
      })),
    },
  ];
  const ready = ![roles, branches, departments, rooms].some(
    (data) => data.loading || data.error,
  );
  const fields: Field[] = [
    ...accountFields,
    roleField,
    {
      name: 'is_active',
      label: 'Trạng thái',
      type: 'select',
      numeric: true,
      required: true,
      defaultValue: '1',
      choices: [
        { value: '1', label: 'Hoạt động' },
        { value: '0', label: 'Đã khóa' },
      ],
    },
  ];
  const params = new URLSearchParams();
  if (filter) params.set('role_id', filter);
  if (query) params.set('keyword', query);
  return (
    <>
      <PageHeader
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Tài khoản"
        description="Quản lý người dùng, trạng thái truy cập và phân công nhân viên."
        actions={
          <Button disabled={!ready} onClick={() => setStaff(true)}>
            Thêm nhân viên
          </Button>
        }
      />
      <Alert>
        {roles.error || branches.error || departments.error || rooms.error}
      </Alert>
      <form
        className="ops-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
      >
        <label className="ops-filter">
          Vai trò
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tất cả vai trò</option>
            {roles.data.map((r) => (
              <option key={String(r.id)} value={String(r.id)}>
                {String(r.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="ops-filter">
          Họ tên hoặc điện thoại
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            maxLength={150}
          />
        </label>
        <Button type="submit" variant="secondary">
          Tìm kiếm
        </Button>
      </form>
      <ResourcePanel
        key={params.toString()}
        title="Danh sách tài khoản"
        path="/admin/users"
        listPath={`/admin/users?${params}`}
        paginated
        fields={fields}
        refreshKey={revision}
        canCreate={ready}
        canDelete={(row) => row.user_id !== session?.user.user_id}
        columns={[
          { key: 'full_name', label: 'HỌ TÊN' },
          { key: 'phone', label: 'ĐIỆN THOẠI' },
          {
            key: 'role_id',
            label: 'VAI TRÒ',
            render: (row) => roleName(row.role_id),
          },
          {
            key: 'is_active',
            label: 'TRẠNG THÁI',
            render: (row) => (
              <span
                className={`ops-pill${row.is_active === 1 ? ' ops-pill--green' : ''}`}
              >
                {row.is_active === 1 ? 'Hoạt động' : 'Đã khóa'}
              </span>
            ),
          },
        ]}
        actions={(row) => (
          <>
            <Button variant="quiet" size="small" onClick={() => setDetail(row)}>
              Chi tiết
            </Button>
            {roleName(row.role_id) !== 'patient' ? (
              <Button
                variant="quiet"
                size="small"
                disabled={!ready}
                onClick={() => setAssign(row)}
              >
                Phân công
              </Button>
            ) : null}
          </>
        )}
      />
      {staff ? (
        <Editor
          title="Thêm nhân viên"
          fields={[
            ...accountFields,
            {
              ...roleField,
              choices: roleField.choices?.filter(
                (option) => option.label !== 'patient',
              ),
            },
            ...assignmentFields,
          ]}
          onClose={() => setStaff(false)}
          onSave={async (body) => {
            await api('/auth/admin/create-staff', 'POST', body);
            setRevision((v) => v + 1);
          }}
        />
      ) : null}
      {assign ? (
        <Editor
          title={`Phân công · ${label(assign.full_name)}`}
          fields={assignmentFields}
          row={assign}
          onClose={() => setAssign(null)}
          onSave={async (body) => {
            await api(`/admin/users/${rowId(assign)}/assign`, 'PUT', body);
            setRevision((v) => v + 1);
          }}
        />
      ) : null}
      {detail ? (
        <UserDetails
          row={detail}
          path={`/admin/users/${rowId(detail)}`}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </>
  );
}
