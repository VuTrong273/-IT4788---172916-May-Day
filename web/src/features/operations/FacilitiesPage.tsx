import { useAuth } from "@/features/auth/auth-context";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Icon, type IconName } from '@/components/ui/icon';
import { useData, type Row } from "./api";
import { Alert, choices, ResourcePanel, type Field } from "./shared";

export function FacilitiesPage() {
  const { can } = useAuth();
  const [selectedTab, setTab] = useState("branches");
  const tabs = [
    { value: "branches", label: "Chi nhánh" },
    { value: "departments", label: "Khoa" },
    { value: "rooms", label: "Phòng" },
  ].filter((item) => can("GET", "/" + item.value));
  const tab = tabs.some((item) => item.value === selectedTab)
    ? selectedTab
    : (tabs[0]?.value ?? "");
  const branches = useData<Row[]>("/branches", []);
  const departments = useData<Row[]>("/departments", []);
  const [branch, setBranch] = useState("");
  const [department, setDepartment] = useState("");
  const names = (rows: Row[], value: unknown) =>
    (rows.find((r) => r.id === value)?.name as string) ?? "—";
  const base: Field[] = [
    { name: "name", label: "Tên", required: true, maxLength: 150 },
  ];
  const fields: Record<string, Field[]> = {
    branches: [
      ...base,
      { name: "address", label: "Địa chỉ", required: true, maxLength: 255 },
      {
        name: "phone",
        label: "Điện thoại",
        type: "tel",
        required: true,
        maxLength: 20,
      },
    ],
    departments: [
      ...base,
      {
        name: "branch_id",
        label: "Chi nhánh",
        type: "select",
        required: true,
        numeric: true,
        choices: choices(branches.data),
      },
      {
        name: "description",
        label: "Mô tả",
        type: "textarea",
        maxLength: 255,
        nullable: true,
      },
    ],
    rooms: [
      ...base,
      {
        name: "department_id",
        label: "Khoa",
        type: "select",
        required: true,
        numeric: true,
        choices: departments.data.map((r) => ({
          value: String(r.id),
          label: `${String(r.name)} · ${names(branches.data, r.branch_id)}`,
        })),
      },
      {
        name: "description",
        label: "Mô tả",
        type: "textarea",
        maxLength: 255,
        nullable: true,
      },
    ],
  };
  const title =
    tab === "branches" ? "Chi nhánh" : tab === "departments" ? "Khoa" : "Phòng";
  const tabIcons: Record<string, IconName> = { branches: 'facility', departments: 'department', rooms: 'room' };
  const tabDescriptions: Record<string, string> = { branches: 'Địa điểm và liên hệ', departments: 'Chuyên môn và tổ chức', rooms: 'Không gian khám bệnh' };
  const filter =
    tab === "departments" && branch
      ? `?branch_id=${branch}`
      : tab === "rooms" && department
        ? `?department_id=${department}`
        : "";
  return (
    <div className="facilities-page">
      <PageHeader
        eyebrow="TỔ CHỨC Y TẾ"
        title="Cơ sở khám"
        description="Quản lý chi nhánh, khoa và phòng khám trong hệ thống."
      />
      <div className="facility-navigation" role="group" aria-label="Cấp cơ sở">
        {tabs.map(item => <button key={item.value} type="button" aria-pressed={tab === item.value} className={`facility-tab facility-tab--${item.value}${tab === item.value ? ' is-active' : ''}`} onClick={() => setTab(item.value)}>
          <span className="facility-tab__icon"><Icon name={tabIcons[item.value]} size={23} /></span>
          <span className="facility-tab__copy"><strong>{item.label}</strong><small>{tabDescriptions[item.value]}</small></span>
          <Icon name="chevron" size={16} className="facility-tab__arrow" />
        </button>)}
      </div>
      <Alert>{branches.error || departments.error}</Alert>
      {tab !== "branches" ? (
        <label className="ops-filter facility-parent-filter">
          {tab === "departments" ? "Chi nhánh" : "Khoa"}
          <select
            value={tab === "departments" ? branch : department}
            onChange={(e) =>
              tab === "departments"
                ? setBranch(e.target.value)
                : setDepartment(e.target.value)
            }
          >
            <option value="">Tất cả</option>
            {(tab === "departments" ? branches.data : departments.data).map(
              (row) => (
                <option key={String(row.id)} value={String(row.id)}>
                  {String(row.name)}
                  {tab === "rooms"
                    ? ` · ${names(branches.data, row.branch_id)}`
                    : ""}
                </option>
              ),
            )}
          </select>
        </label>
      ) : null}
      <ResourcePanel
        key={`${tab}-${filter}`}
        title={`Danh sách ${title.toLocaleLowerCase('vi')}`}
        titleIcon={<Icon name={tabIcons[tab]} size={19} />}
        createLabel={`Thêm ${title.toLocaleLowerCase('vi')}`}
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
          { key: "name", label: "TÊN", render: row => <div className="facility-name"><span className={`facility-row-icon facility-row-icon--${tab}`}><Icon name={tabIcons[tab]} size={19} /></span><span><strong>{String(row.name)}</strong><small>Mã {title.toLocaleLowerCase('vi')} #{String(row.id)}</small></span></div> },
          ...(tab === "branches"
            ? [
                { key: "address", label: "ĐỊA CHỈ", render: (row: Row) => <span className="facility-contact"><Icon name="pin" size={15} />{String(row.address || 'Chưa cập nhật')}</span> },
                { key: "phone", label: "ĐIỆN THOẠI", render: (row: Row) => row.phone ? <a className="facility-contact facility-phone" href={`tel:${String(row.phone).replace(/[^\d+]/g, '')}`}><Icon name="phone" size={15} />{String(row.phone)}</a> : <span className="facility-contact">Chưa cập nhật</span> },
              ]
            : [
                {
                  key: tab === "departments" ? "branch_id" : "department_id",
                  label: tab === "departments" ? "CHI NHÁNH" : "KHOA",
                  render: (row: Row) =>
                    <span className="facility-parent"><Icon name={tab === 'departments' ? 'facility' : 'department'} size={14} />{names(
                      tab === "departments" ? branches.data : departments.data,
                      row[
                        tab === "departments" ? "branch_id" : "department_id"
                      ],
                    )}</span>,
                },
                { key: "description", label: "MÔ TẢ" },
              ]),
        ]}
        onChanged={() => {
          branches.reload();
          departments.reload();
        }}
      />
    </div>
  );
}
