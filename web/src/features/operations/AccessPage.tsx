import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { allPages, label, message, useApi, useData, type Row } from './api';
import { Alert, choices, ResourcePanel, Tabs, type Field } from './shared';

function AssignmentPanel({ kind }: { kind: 'role' | 'permission' }) {
  const api = useApi();
  const role = kind === 'role';
  const parents = useData<Row[]>(role ? '/roles' : '/permissions', []);
  const [options, setOptions] = useState<Row[]>([]);
  const [parent, setParent] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [revision, setRevision] = useState(0);
  const root = role ? '/role_permissions' : '/permission_endpoints';
  const parentKey = role ? 'role_id' : 'permission_id';
  const childKey = role ? 'permission_id' : 'endpoint_id';
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setNotice('');
    async function load() {
      const all = await allPages<Row>(
        api,
        role ? '/permissions' : '/api_endpoints',
        controller.signal,
      );
      const assigned = parent
        ? (
            await api<Row[]>(
              `${root}/${role ? 'role' : 'permission'}/${parent}`,
              'GET',
              undefined,
              controller.signal,
            )
          ).data
        : [];
      if (!controller.signal.aborted) {
        setOptions(all);
        setSelected(new Set(assigned.map((r) => Number(r[childKey]))));
      }
    }
    load()
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, role, root, parent, childKey, revision]);
  async function save() {
    if (!parent || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const current = (
        await api<Row[]>(`${root}/${role ? 'role' : 'permission'}/${parent}`)
      ).data.map((r) => Number(r[childKey]));
      const added = [...selected].filter((id) => !current.includes(id));
      const removed = current.filter((id) => !selected.has(id));
      for (let offset = 0; offset < added.length; offset += 100)
        await api(root, 'POST', {
          [parentKey]: Number(parent),
          [role ? 'permissions' : 'endpoints']: added.slice(
            offset,
            offset + 100,
          ),
        });
      for (const id of removed)
        await api(
          `${root}/${role ? 'role' : 'permission'}/${parent}/${role ? 'permission' : 'endpoint'}/${id}`,
          'DELETE',
        );
      setNotice('Đã cập nhật quyền truy cập.');
    } catch (e) {
      setError(
        `${message(e)} Một phần thay đổi có thể đã lưu. Hãy tải lại trước khi tiếp tục.`,
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = options.filter((row) =>
    `${label(row.name)} ${label(row.method)} ${label(row.path)}`
      .toLocaleLowerCase('vi')
      .includes(search.toLocaleLowerCase('vi')),
  );
  return (
    <Panel
      title={role ? 'Gán quyền cho vai trò' : 'Gán API cho quyền'}
      className="ops-resource"
    >
      <div className="ops-form">
        <Alert>{parents.error}</Alert>
        <div className="ops-toolbar">
          <label className="ops-filter">
            {role ? 'Vai trò' : 'Quyền'}
            <select
              aria-label={role ? 'Vai trò' : 'Quyền'}
              value={parent}
              disabled={busy || parents.loading}
              onChange={(e) => setParent(e.target.value)}
            >
              <option value="">Chọn {role ? 'vai trò' : 'quyền'}…</option>
              {parents.data.map((r) => (
                <option key={String(r.id)} value={String(r.id)}>
                  {label(r.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="ops-filter">
            Lọc danh sách
            <input
              value={search}
              disabled={busy}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={busy || loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            Tải lại
          </Button>
        </div>
        {role ? (
          <p className="ops-help">
            Các mục được chọn là quyền gán trực tiếp. Vai trò còn kế thừa quyền
            từ vai trò cha.
          </p>
        ) : null}
        <Alert>{error}</Alert>
        <Alert success>{notice}</Alert>
        {!parent ? (
          <p>Chọn {role ? 'vai trò' : 'quyền'} để xem và chỉnh sửa.</p>
        ) : loading ? (
          <p role="status">Đang tải…</p>
        ) : (
          <>
            <div className="ops-checklist">
              {visible.length ? (
                visible.map((row) => (
                  <label className="ops-check" key={String(row.id)}>
                    <input
                      type="checkbox"
                      disabled={busy || Boolean(error)}
                      checked={selected.has(Number(row.id))}
                      onChange={(e) =>
                        setSelected((before) => {
                          const next = new Set(before);
                          if (e.target.checked) next.add(Number(row.id));
                          else next.delete(Number(row.id));
                          return next;
                        })
                      }
                    />
                    <span>
                      <strong>{label(row.name)}</strong>
                      <small>
                        {role
                          ? label(row.description)
                          : `${label(row.method)} ${label(row.path)}`}
                      </small>
                    </span>
                  </label>
                ))
              ) : (
                <p>Không có mục phù hợp.</p>
              )}
            </div>
            <div className="ops-form-actions">
              <span>{selected.size} mục được chọn</span>
              <Button
                disabled={busy || Boolean(error)}
                onClick={() => void save()}
              >
                {busy ? 'Đang lưu…' : 'Lưu phân quyền'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

export function AccessPage() {
  const [tab, setTab] = useState('roles');
  const roles = useData<Row[]>('/roles', []);
  const name: Field = {
    name: 'name',
    label: 'Tên',
    required: true,
    maxLength: tab === 'roles' ? 50 : 100,
  };
  const description: Field = {
    name: 'description',
    label: 'Mô tả',
    type: 'textarea',
    maxLength: 255,
    nullable: true,
  };
  const roleFields: Field[] = [
    name,
    description,
    {
      name: 'parent_role_id',
      label: 'Vai trò cha',
      type: 'select',
      nullable: true,
      numeric: true,
      choices: choices(roles.data),
    },
  ];
  const endpointFields: Field[] = [
    name,
    {
      name: 'method',
      label: 'Phương thức',
      type: 'select',
      required: true,
      choices: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((v) => ({
        value: v,
        label: v,
      })),
    },
    {
      name: 'path',
      label: 'Đường dẫn API',
      required: true,
      maxLength: 255,
      hint: 'Bắt đầu bằng /api/v1/. Tham số có dạng :id.',
    },
    description,
    {
      name: 'is_public',
      label: 'Kiểm tra quyền truy cập',
      type: 'select',
      numeric: true,
      required: true,
      defaultValue: '0',
      choices: [
        { value: '0', label: 'Theo quyền được gán' },
        { value: '1', label: 'Mọi tài khoản đã đăng nhập' },
      ],
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="BẢO MẬT HỆ THỐNG"
        title="Phân quyền"
        description="Quản lý vai trò, quyền hạn và phạm vi API mà từng tài khoản được truy cập."
      />
      <Tabs
        label="Quản lý phân quyền"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'roles', label: 'Vai trò' },
          { value: 'permissions', label: 'Quyền' },
          { value: 'api_endpoints', label: 'Danh mục API' },
          { value: 'role-map', label: 'Quyền của vai trò' },
          { value: 'endpoint-map', label: 'API của quyền' },
        ]}
      />
      <Alert>{roles.error}</Alert>
      {tab.endsWith('-map') ? (
        <AssignmentPanel
          key={tab}
          kind={tab === 'role-map' ? 'role' : 'permission'}
        />
      ) : (
        <ResourcePanel
          key={tab}
          title={
            tab === 'roles'
              ? 'Vai trò'
              : tab === 'permissions'
                ? 'Quyền'
                : 'Danh mục API'
          }
          path={`/${tab}`}
          paginated={tab === 'api_endpoints'}
          fields={
            tab === 'roles'
              ? roleFields
              : tab === 'permissions'
                ? [name, description]
                : endpointFields
          }
          canDelete={(row) =>
            tab !== 'roles' ||
            !['admin', 'doctor', 'patient'].includes(String(row.name))
          }
          columns={[
            { key: 'name', label: 'TÊN' },
            ...(tab === 'api_endpoints'
              ? [
                  { key: 'method', label: 'PHƯƠNG THỨC' },
                  { key: 'path', label: 'ĐƯỜNG DẪN' },
                ]
              : [{ key: 'description', label: 'MÔ TẢ' }]),
            ...(tab === 'roles'
              ? [
                  {
                    key: 'parent_role_id',
                    label: 'VAI TRÒ CHA',
                    render: (row: Row) =>
                      label(
                        roles.data.find((r) => r.id === row.parent_role_id)
                          ?.name,
                      ),
                  },
                ]
              : []),
          ]}
          onChanged={roles.reload}
        />
      )}
    </>
  );
}
