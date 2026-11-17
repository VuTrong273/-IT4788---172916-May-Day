import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { useData, type Row } from './api';
import { Alert, choices, ResourcePanel, Tabs, type Field } from './shared';

export function FacilitiesPage() {
  const [tab, setTab] = useState('branches');
  const branches = useData<Row[]>('/branches', []);
  const departments = useData<Row[]>('/departments', []);
  const [branch, setBranch] = useState('');
  const [department, setDepartment] = useState('');
  const names = (rows: Row[], value: unknown) =>
    (rows.find((r) => r.id === value)?.name as string) ?? '—';
  const base: Field[] = [
    { name: 'name', label: 'Tên', required: true, maxLength: 150 },
  ];
  const fields: Record<string, Field[]> = {
    branches: [
      ...base,
      { name: 'address', label: 'Địa chỉ', required: true, maxLength: 255 },
      {
        name: 'phone',
        label: 'Điện thoại',
        type: 'tel',
        required: true,
        maxLength: 20,
      },
    ],
    departments: [
      ...base,
      {
        name: 'branch_id',
        label: 'Chi nhánh',
        type: 'select',
        required: true,
        numeric: true,
        choices: choices(branches.data),
      },
      {
        name: 'description',
        label: 'Mô tả',
        type: 'textarea',
        maxLength: 255,
        nullable: true,
      },
    ],
    rooms: [
      ...base,
      {
        name: 'department_id',
        label: 'Khoa',
        type: 'select',
        required: true,
        numeric: true,
        choices: departments.data.map((r) => ({
          value: String(r.id),
          label: `${String(r.name)} · ${names(branches.data, r.branch_id)}`,
        })),
      },
      {
        name: 'description',
        label: 'Mô tả',
        type: 'textarea',
        maxLength: 255,
        nullable: true,
      },
    ],
  };
  const title =
    tab === 'branches' ? 'Chi nhánh' : tab === 'departments' ? 'Khoa' : 'Phòng';
  const filter =
    tab === 'departments' && branch
      ? `?branch_id=${branch}`
      : tab === 'rooms' && department
        ? `?department_id=${department}`
        : '';
  return (
    <>
      <PageHeader
        eyebrow="TỔ CHỨC Y TẾ"
        title="Cơ sở khám"
        description="Quản lý chi nhánh, khoa và phòng khám trong hệ thống."
      />
      <Tabs
        label="Cấp cơ sở"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'branches', label: 'Chi nhánh' },
          { value: 'departments', label: 'Khoa' },
          { value: 'rooms', label: 'Phòng' },
        ]}
      />
      <Alert>{branches.error || departments.error}</Alert>
      {tab !== 'branches' ? (
        <label className="ops-filter">
          {tab === 'departments' ? 'Chi nhánh' : 'Khoa'}
          <select
            value={tab === 'departments' ? branch : department}
            onChange={(e) =>
              tab === 'departments'
                ? setBranch(e.target.value)
                : setDepartment(e.target.value)
            }
          >
            <option value="">Tất cả</option>
            {(tab === 'departments' ? branches.data : departments.data).map(
              (row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.name)}
                  {tab === 'rooms'
                    ? ` · ${names(branches.data, row.branch_id)}`
                    : ''}
                </option>
              ),
            )}
          </select>
        </label>
      ) : null}
      <ResourcePanel
        key={`${tab}-${filter}`}
        title={title}
        path={`/${tab}`}
        listPath={`/${tab}${filter}`}
        fields={fields[tab]}
        canCreate={
          !branches.error &&
          !departments.error &&
          !branches.loading &&
          !departments.loading
        }
        columns={[
          { key: 'name', label: 'TÊN' },
          ...(tab === 'branches'
            ? [
                { key: 'address', label: 'ĐỊA CHỈ' },
                { key: 'phone', label: 'ĐIỆN THOẠI' },
              ]
            : [
                {
                  key: tab === 'departments' ? 'branch_id' : 'department_id',
                  label: tab === 'departments' ? 'CHI NHÁNH' : 'KHOA',
                  render: (row: Row) =>
                    names(
                      tab === 'departments' ? branches.data : departments.data,
                      row[
                        tab === 'departments' ? 'branch_id' : 'department_id'
                      ],
                    ),
                },
                { key: 'description', label: 'MÔ TẢ' },
              ]),
        ]}
        onChanged={() => {
          branches.reload();
          departments.reload();
        }}
      />
    </>
  );
}
