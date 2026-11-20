import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/features/auth/auth-context";
import { message, useApi, useData, type Row } from "./api";
import { Alert } from "./shared";
import { describePermission, displayRole } from "./access-labels";

export function RolePermissions() {
  const api = useApi();
  const { can, refreshAccess } = useAuth();
  const roles = useData<Row[]>("/roles", []);
  const permissions = useData<Row[]>("/permissions", []);
  const [selectedRole, setRole] = useState("");
  const role =
    roles.data.find((row) => String(row.id) === selectedRole) ?? roles.data[0];
  const roleId = role ? String(role.id) : "";
  const [selected, setSelected] = useState(new Set<number>());
  const [original, setOriginal] = useState(new Set<number>());
  const [inherited, setInherited] = useState(new Set<number>());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGroup, setGroup] = useState("");
  const [permissionPage, setPermissionPage] = useState(1);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!roleId) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setNotice("");
    setSelected(new Set());
    setOriginal(new Set());
    setInherited(new Set());
    async function load() {
      const direct = (
        await api<Row[]>(
          `/role_permissions/role/${roleId}`,
          "GET",
          undefined,
          controller.signal,
        )
      ).data;
      const inheritedIds = new Set<number>();
      const visited = new Set([roleId]);
      let parent = role?.parent_role_id;
      while (parent != null && !visited.has(String(parent))) {
        visited.add(String(parent));
        const result = await api<Row[]>(
          `/role_permissions/role/${parent}`,
          "GET",
          undefined,
          controller.signal,
        );
        result.data.forEach((row) =>
          inheritedIds.add(Number(row.permission_id)),
        );
        parent = roles.data.find(
          (row) => String(row.id) === String(parent),
        )?.parent_role_id;
      }
      if (controller.signal.aborted) return;
      const ids = new Set(direct.map((row) => Number(row.permission_id)));
      setSelected(ids);
      setOriginal(new Set(ids));
      setInherited(inheritedIds);
    }
    void load()
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, roleId, role?.parent_role_id, roles.data, revision]);
  const dirty =
    selected.size !== original.size ||
    [...selected].some((id) => !original.has(id));
  const groups = useMemo(() => {
    const result = new Map<string, { row: Row; title: string }[]>();
    for (const row of permissions.data) {
      const { title, group } = describePermission(row);
      if (
        !`${title} ${group}`
          .toLocaleLowerCase("vi")
          .includes(search.trim().toLocaleLowerCase("vi"))
      )
        continue;
      result.set(group, [...(result.get(group) ?? []), { row, title }]);
    }
    return [...result];
  }, [permissions.data, search]);
  const currentGroup = groups.find(([name]) => name === selectedGroup) ?? groups[0];
  const pageCount = Math.max(1, Math.ceil((currentGroup?.[1].length ?? 0) / 6));
  const currentPage = Math.min(permissionPage, pageCount);
  async function save() {
    if (busy || loading || !dirty || !roleId || error) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const current = (
        await api<Row[]>(`/role_permissions/role/${roleId}`)
      ).data.map((row) => Number(row.permission_id));
      if (
        current.length !== original.size ||
        current.some((id) => !original.has(id))
      )
        throw new Error(
          "Phân quyền đã được thay đổi ở nơi khác. Hãy tải lại trước khi lưu.",
        );
      const added = [...selected].filter((id) => !original.has(id));
      for (let offset = 0; offset < added.length; offset += 100)
        await api("/role_permissions", "POST", {
          role_id: Number(roleId),
          permissions: added.slice(offset, offset + 100),
        });
      for (const id of original)
        if (!selected.has(id))
          await api(
            `/role_permissions/role/${roleId}/permission/${id}`,
            "DELETE",
          );
      setOriginal(new Set(selected));
      setNotice(`Đã lưu phân quyền cho ${displayRole(role?.name)}.`);
      await refreshAccess();
    } catch (reason) {
      setError(
        `${message(reason)} Hãy tải lại để kiểm tra các thay đổi đã lưu.`,
      );
    } finally {
      setBusy(false);
    }
  }
  const blocked =
    busy ||
    loading ||
    permissions.loading ||
    roles.loading ||
    !!(error || roles.error || permissions.error);
  return (
    <div className="role-permissions">
      <aside className="access-role-list">
        <div className="access-role-list__title">
          <Icon name="users" size={17} />
          Chọn vai trò
        </div>
        {roles.loading ? (
          <p role="status">Đang tải vai trò…</p>
        ) : (
          roles.data.map((item) => (
            <button
              type="button"
              key={String(item.id)}
              disabled={busy}
              aria-pressed={String(item.id) === roleId}
              className={String(item.id) === roleId ? "is-active" : ""}
              onClick={() => {
                setRole(String(item.id));
                setSearch("");
                setPermissionPage(1);
              }}
            >
              <span className="access-role-icon">
                <Icon
                  name={
                    item.name === "patient"
                      ? "user"
                      : item.name === "admin"
                        ? "shield"
                        : "patient"
                  }
                  size={19}
                />
              </span>
              <span>
                <strong>{displayRole(item.name)}</strong>
                <small>{String(item.description || "Vai trò tùy chỉnh")}</small>
              </span>
              <Icon name="chevron" size={13} />
            </button>
          ))
        )}
        <p className="access-role-list__help">
          Chọn vai trò, đánh dấu các chức năng được phép sử dụng rồi lưu thay
          đổi.
        </p>
      </aside>
      <section className="access-permission-panel" aria-busy={busy || loading}>
        <div className="access-permission-header">
          <div>
            <span>CHỨC NĂNG ĐƯỢC PHÉP</span>
            <h2>{role ? displayRole(role.name) : "Chưa có vai trò"}</h2>
          </div>
          <Button
            variant="secondary"
            size="small"
            icon={<Icon name="refresh" size={14} />}
            disabled={busy}
            onClick={() => setRevision((value) => value + 1)}
          >
            Tải lại
          </Button>
        </div>
        <div className="access-permission-toolbar">
        <div className="access-search">
          <Icon name="search" size={16} />
          <input
            aria-label="Tìm chức năng phân quyền"
            placeholder="Tìm chức năng, ví dụ: bệnh án, xét nghiệm…"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPermissionPage(1); }}
            disabled={busy}
          />
        </div>
        <div className="access-group-picker">
          <label htmlFor="permission-group">Nhóm chức năng</label>
          <select id="permission-group" value={currentGroup?.[0] ?? ""} disabled={busy || !groups.length} onChange={(event) => { setGroup(event.target.value); setPermissionPage(1); }}>
            {!groups.length ? <option value="">Không có nhóm phù hợp</option> : null}
            {groups.map(([name, items]) => <option key={name} value={name}>{name} ({items.length})</option>)}
          </select>
        </div>
        </div>
        <div className="access-permission-body">
          <Alert>{roles.error || permissions.error || error}</Alert>
          <Alert success>{notice}</Alert>
          {role?.parent_role_id != null ? (
            <p className="access-inheritance">
              <Icon name="shield" size={15} />
              Kế thừa quyền từ{" "}
              {displayRole(
                roles.data.find((item) => item.id === role.parent_role_id)
                  ?.name,
              )}
              . Quyền kế thừa cần được chỉnh tại vai trò gốc.
            </p>
          ) : null}
          {loading || permissions.loading ? (
            <p role="status">Đang tải chức năng…</p>
          ) : !role ? (
            <p>Thêm vai trò trong mục Quản lý vai trò để bắt đầu.</p>
          ) : groups.length ? (
            (currentGroup ? [currentGroup] : []).map(([group, items]) => (
              <fieldset key={group} className="access-permission-group">
                <legend>{group}</legend>
                <div>
                  {items.slice((currentPage - 1) * 6, currentPage * 6).map(({ row, title }) => {
                    const id = Number(row.id),
                      inheritedOnly = inherited.has(id),
                      checked = selected.has(id) || inheritedOnly;
                    const writable = checked
                      ? can(
                          "DELETE",
                          `/role_permissions/role/${roleId}/permission/${id}`,
                        )
                      : can("POST", "/role_permissions");
                    return (
                      <label
                        key={id}
                        className={`access-permission-item${checked ? " is-checked" : ""}${inheritedOnly ? " is-inherited" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={blocked || inheritedOnly || !writable}
                          onChange={(event) =>
                            setSelected((previous) => {
                              const next = new Set(previous);
                              if (event.target.checked) next.add(id);
                              else next.delete(id);
                              return next;
                            })
                          }
                        />
                        <span>{title}</span>
                        {inheritedOnly ? <small>Kế thừa</small> : null}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))
          ) : (
            <p>Không có chức năng phù hợp.</p>
          )}
        </div>
        <div className="access-permission-footer">
          <span>
            <strong>{new Set([...selected, ...inherited]).size}</strong> chức
            năng được phép{dirty ? " · Có thay đổi chưa lưu" : ""}
          </span>
        {pageCount > 1 ? <div className="access-group-pagination">
          <Button size="small" variant="quiet" disabled={currentPage === 1} onClick={() => setPermissionPage(currentPage - 1)}>Trước</Button>
          <span>{currentPage} / {pageCount}</span>
          <Button size="small" variant="quiet" disabled={currentPage === pageCount} onClick={() => setPermissionPage(currentPage + 1)}>Sau</Button>
        </div> : null}
          <Button
            icon={<Icon name="check" size={16} />}
            disabled={blocked || !dirty}
            onClick={() => void save()}
          >
            {busy ? "Đang lưu…" : "Lưu phân quyền"}
          </Button>
        </div>
      </section>
    </div>
  );
}
