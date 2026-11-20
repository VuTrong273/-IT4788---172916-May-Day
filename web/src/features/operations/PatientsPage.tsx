import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { label, useApi, type Row } from "./api";
import { Alert, Editor, ResourcePanel } from "./shared";
import { patientFields } from "./fields";
import { UserDetails } from "./UsersPage";
import { useAuth } from "@/features/auth/auth-context";

function patientQuery(value: string) {
  const term = value.trim();
  const phone = /^[\d\s]+$/.test(term);
  const normalized = phone ? term.replace(/\s/g, "") : term;
  if (normalized.length < (phone ? 3 : 2)) return "";
  return new URLSearchParams({
    [phone ? "phone" : "full_name"]: normalized,
  }).toString();
}

export function PatientsPage() {
  const { can } = useAuth();
  const api = useApi();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const readyQuery = patientQuery(search);
  useEffect(() => {
    if (!readyQuery) {
      setQuery("");
      return;
    }
    const timer = window.setTimeout(() => setQuery(readyQuery), 400);
    return () => window.clearTimeout(timer);
  }, [readyQuery]);
  return (
    <div className="patients-page">
      <PageHeader
        eyebrow="TIẾP NHẬN NGƯỜI BỆNH"
        title="Bệnh nhân"
        description="Tra cứu và quản lý hồ sơ người bệnh."
        actions={
          can("POST", "/doctor/patients") ? (
            <Button
              icon={<Icon name="plus" size={17} />}
              onClick={() => setCreating(true)}
            >
              Tạo hồ sơ bệnh nhân
            </Button>
          ) : undefined
        }
      />
      <Panel className="patient-search-panel">
        <div className="patient-search-heading">
          <span className="patient-search-symbol">
            <Icon name="patient" size={25} />
          </span>
          <h2>Tìm bệnh nhân</h2>
          <span className="patient-search-tag">
            <Icon name="shield" size={14} />
            Tra cứu hồ sơ
          </span>
        </div>
        <form
          className="patient-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(readyQuery);
          }}
        >
          <label className="patient-search-input">
            <Icon name="search" size={21} />
            <span className="sr-only">Họ tên hoặc số điện thoại bệnh nhân</span>
            <input
              value={search}
              maxLength={150}
              placeholder="Ví dụ: Nguyễn Văn hoặc 090…"
              autoComplete="off"
              onChange={(e) => {
                setSearch(e.target.value);
                setNotice("");
              }}
              aria-describedby="patient-search-help"
            />
            {search ? (
              <button
                type="button"
                aria-label="Xóa nội dung tìm kiếm"
                onClick={() => {
                  setSearch("");
                  setQuery("");
                }}
              >
                <Icon name="close" size={15} />
              </button>
            ) : null}
          </label>
          <Button
            type="submit"
            disabled={!readyQuery}
            icon={<Icon name="search" size={17} />}
          >
            Tìm bệnh nhân
          </Button>
        </form>
        <div className="patient-search-help" id="patient-search-help">
          <Icon name="mark" size={15} />
          <span>
            {search.trim() && !readyQuery
              ? "Nhập ít nhất 2 ký tự tên hoặc 3 chữ số điện thoại."
              : "Tìm theo tên hoặc số điện thoại, không cần mã bệnh nhân."}
          </span>
        </div>
      </Panel>
      <Alert success>{notice}</Alert>
      {query && query === readyQuery ? (
        <ResourcePanel
          key={query}
          title="Kết quả tra cứu"
          titleIcon={<Icon name="users" size={20} />}
          path="/doctor/patients"
          listPath={`/doctor/patients/search?${query}`}
          fields={[]}
          paginated
          pageSize={5}
          canCreate={false}
          canEdit={false}
          canDelete={false}
          refreshKey={revision}
          emptyMessage={
            <div className="patient-no-results">
              <Icon name="search" size={28} />
              <strong>Chưa tìm thấy bệnh nhân phù hợp</strong>
              <p>
                Thử rút ngắn tên hoặc kiểm tra lại số điện thoại. Nếu đây là
                người bệnh mới, hãy tạo hồ sơ.
              </p>
              {can("POST", "/doctor/patients") ? (
                <Button
                  variant="secondary"
                  icon={<Icon name="plus" size={15} />}
                  onClick={() => setCreating(true)}
                >
                  Tạo hồ sơ bệnh nhân
                </Button>
              ) : null}
            </div>
          }
          columns={[
            {
              key: "full_name",
              label: "NGƯỜI BỆNH",
              render: (row: Row) => (
                <div className="patient-identity">
                  <span>
                    <Icon name="user" size={20} />
                  </span>
                  <div>
                    <strong>{label(row.full_name)}</strong>
                    <small>Mã hồ sơ #{String(row.user_id)}</small>
                  </div>
                </div>
              ),
            },
            {
              key: "phone",
              label: "SỐ ĐIỆN THOẠI",
              render: (row: Row) => (
                <span className="patient-phone">
                  <Icon name="phone" size={14} />
                  {label(row.phone)}
                </span>
              ),
            },
            {
              key: "year_of_birth",
              label: "NĂM SINH",
              render: (row: Row) => label(row.year_of_birth),
            },
            {
              key: "gender",
              label: "GIỚI TÍNH",
              render: (row: Row) =>
                row.gender === "male"
                  ? "Nam"
                  : row.gender === "female"
                    ? "Nữ"
                    : row.gender === "other"
                      ? "Khác"
                      : "—",
            },
            {
              key: "address",
              label: "ĐỊA CHỈ",
              render: (row: Row) => (
                <span className="patient-address">
                  {[row.commune_address, row.city_address]
                    .filter(Boolean)
                    .join(", ") || "Chưa cập nhật"}
                </span>
              ),
            },
          ]}
          actions={(row) => (
            <Button
              variant="secondary"
              size="small"
              icon={<Icon name="eye" size={15} />}
              onClick={() => setDetail(row)}
            >
              Xem hồ sơ
            </Button>
          )}
        />
      ) : readyQuery ? (
        <div className="ops-state" role="status">
          Đang tìm bệnh nhân…
        </div>
      ) : null}
      {creating ? (
        <Editor
          title="Tạo hồ sơ bệnh nhân"
          fields={patientFields}
          onClose={() => setCreating(false)}
          onSave={async (body) => {
            const created = await api<Row>("/doctor/patients", "POST", body);
            const phone = String(created.data.phone);
            setSearch(phone);
            setQuery(patientQuery(phone));
            setRevision((v) => v + 1);
            setNotice(`Đã tạo hồ sơ cho ${String(created.data.full_name)}.`);
          }}
        />
      ) : null}
      {detail ? (
        <UserDetails row={detail} onClose={() => setDetail(null)} />
      ) : null}
    </div>
  );
}
