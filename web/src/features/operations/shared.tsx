import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { Icon } from '@/components/ui/icon';
import { label, message, rowId, useApi, type Result, type Row } from './api';

export type Choice = { value: string; label: string; parent?: string };
export type Field = {
  name: string;
  label: string;
  type?:
    'text' | 'number' | 'password' | 'date' | 'select' | 'textarea' | 'tel';
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  choices?: Choice[];
  dependsOn?: string;
  createOnly?: boolean;
  nullable?: boolean;
  defaultValue?: string;
  numeric?: boolean;
  hint?: string;
};
export type Values = Record<string, string>;
export const choices = (rows: Row[], name = 'name'): Choice[] =>
  rows.map((r) => ({ value: rowId(r), label: label(r[name]) }));
export function Alert({
  children,
  success = false,
}: {
  children?: ReactNode;
  success?: boolean;
}) {
  return children ? (
    <div
      className={`ops-alert${success ? ' ops-alert--success' : ''}`}
      role={success ? 'status' : 'alert'}
    >
      <Icon name={success ? 'check' : 'alert'} size={18} />
      <span>{children}</span>
    </div>
  ) : null;
}
export function Tabs({
  items,
  value,
  onChange,
  label: name,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="ops-tabs" role="tablist" aria-label={name}>
      {items.map((item) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === item.value}
          className={
            value === item.value ? 'ops-tab ops-tab--active' : 'ops-tab'
          }
          key={item.value}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="ops-dialog"
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="ops-dialog__header">
        <h2 id={heading}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng"
          disabled={busy}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Fields({
  fields,
  values,
  onChange,
  editing = false,
}: {
  fields: Field[];
  values: Values;
  onChange: (next: Values) => void;
  editing?: boolean;
}) {
  const prefix = useId();
  return (
    <div className="ops-form-grid">
      {fields
        .filter((field) => !editing || !field.createOnly)
        .map((field) => {
          const value = values[field.name] ?? field.defaultValue ?? '';
          const options = field.choices?.filter(
            (option) =>
              !field.dependsOn || option.parent === values[field.dependsOn],
          );
          const change = (next: string) => {
            const result = { ...values, [field.name]: next };
            const cleared = new Set([field.name]);
            for (let i = 0; i < fields.length; i++)
              for (const child of fields)
                if (
                  child.dependsOn &&
                  cleared.has(child.dependsOn) &&
                  !cleared.has(child.name)
                ) {
                  result[child.name] = '';
                  cleared.add(child.name);
                }
            onChange(result);
          };
          const props = {
            id: `${prefix}-${field.name}`,
            'aria-labelledby': `${prefix}-${field.name}-label`,
            'aria-describedby': field.hint
              ? `${prefix}-${field.name}-hint`
              : undefined,
            name: field.name,
            value,
            required: field.required,
            disabled: Boolean(field.dependsOn && !values[field.dependsOn]),
            onChange: (e: { target: { value: string } }) =>
              change(e.target.value),
          };
          return (
            <label
              className={`ops-field${field.type === 'textarea' ? ' ops-field--wide' : ''}`}
              key={field.name}
              htmlFor={props.id}
            >
              <span id={`${props.id}-label`}>
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              {field.type === 'select' ? (
                <select {...props}>
                  <option value="">
                    {field.required ? 'Chọn…' : 'Không chọn'}
                  </option>
                  {options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  {...props}
                  rows={3}
                  maxLength={field.maxLength ?? 10000}
                />
              ) : (
                <input
                  {...props}
                  type={field.type ?? 'text'}
                  min={field.min}
                  max={field.max}
                  minLength={field.minLength}
                  maxLength={field.maxLength ?? 255}
                  pattern={field.pattern}
                  autoComplete={
                    field.type === 'password' ? 'new-password' : undefined
                  }
                />
              )}
              {field.hint ? (
                <small id={`${props.id}-hint`}>{field.hint}</small>
              ) : null}
            </label>
          );
        })}
    </div>
  );
}
export function initialValues(fields: Field[], row?: Row): Values {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      row?.[field.name] === null || row?.[field.name] === undefined
        ? (field.defaultValue ?? '')
        : String(row[field.name]),
    ]),
  );
}
export function payload(fields: Field[], values: Values, editing = false): Row {
  const result: Row = {};
  for (const field of fields) {
    if (editing && field.createOnly) continue;
    const value = values[field.name] ?? field.defaultValue ?? '';
    if (value === '') {
      if (field.nullable) result[field.name] = null;
      continue;
    }
    result[field.name] =
      field.numeric || field.type === 'number'
        ? Number(value)
        : field.type === 'password'
          ? value
          : value.trim();
  }
  return result;
}
export function Editor({
  title,
  fields,
  row,
  onSave,
  onClose,
  children,
  prepare,
}: {
  title: string;
  fields: Field[];
  row?: Row;
  onSave: (body: Row) => Promise<void>;
  onClose: () => void;
  children?: (values: Values, change: (v: Values) => void) => ReactNode;
  prepare?: (body: Row, values: Values) => Row;
}) {
  const [values, setValues] = useState(() => initialValues(fields, row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const body = payload(fields, values, Boolean(row));
      await onSave(prepare ? prepare(body, values) : body);
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <form onSubmit={(e) => void submit(e)} className="ops-form">
        <fieldset disabled={busy}>
          <Fields
            fields={fields}
            values={values}
            onChange={setValues}
            editing={Boolean(row)}
          />
          {children?.(values, setValues)}
        </fieldset>
        <Alert>{error}</Alert>
        <div className="ops-form-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <div className="ops-form">
        <p>{description}</p>
        <Alert>{error}</Alert>
        <div className="ops-form-actions">
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await onConfirm();
                onClose();
              } catch (e) {
                setError(message(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Đang xử lý…' : 'Xác nhận'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
export type Column = {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
};
export function ResourcePanel({
  title,
  path,
  listPath = path,
  fields,
  columns,
  paginated = false,
  createPath = path,
  canEdit = true,
  canDelete = true,
  canCreate = true,
  actions,
  onChanged,
  prepare,
  refreshKey = 0,
}: {
  title: string;
  path: string;
  listPath?: string;
  fields: Field[];
  columns: Column[];
  paginated?: boolean;
  createPath?: string;
  canEdit?: boolean | ((row: Row) => boolean);
  canDelete?: boolean | ((row: Row) => boolean);
  canCreate?: boolean;
  actions?: (row: Row, reload: () => void) => ReactNode;
  onChanged?: () => void;
  prepare?: (body: Row, values: Values) => Row;
  refreshKey?: number;
}) {
  const api = useApi();
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result<Row[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<Row | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [notice, setNotice] = useState('');
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const url = `${listPath}${paginated ? `${listPath.includes('?') ? '&' : '?'}page=${page}&limit=20` : ''}`;
    api<Row[]>(url, 'GET', undefined, controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        if (paginated && page > 1 && !next.data.length) {
          setPage((v) => Math.max(1, v - 1));
          return;
        }
        setResult(next);
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setError(message(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, listPath, paginated, page, revision, refreshKey]);
  function changed(text: string) {
    setNotice(text);
    reload();
    onChanged?.();
  }
  const allowed = (flag: boolean | ((row: Row) => boolean), row: Row) =>
    typeof flag === 'function' ? flag(row) : flag;
  return (
    <>
      <Panel
        title={title}
        className="ops-resource"
        action={
          <div className="ops-actions">
            <Button
              variant="quiet"
              size="small"
              onClick={reload}
              disabled={loading}
            >
              Làm mới
            </Button>
            {canCreate ? (
              <Button
                size="small"
                icon={<Icon name="plus" size={16} />}
                onClick={() => {
                  setNotice('');
                  setEditor('new');
                }}
              >
                Thêm mới
              </Button>
            ) : null}
          </div>
        }
      >
        <Alert success>{notice}</Alert>
        {error ? (
          <div className="ops-state">
            <Alert>{error}</Alert>
            <Button variant="secondary" onClick={reload}>
              Thử lại
            </Button>
          </div>
        ) : loading ? (
          <div className="ops-state" role="status">
            Đang tải dữ liệu…
          </div>
        ) : !result?.data.length ? (
          <div className="ops-state">
            Chưa có dữ liệu. {canCreate ? 'Chọn “Thêm mới” để bắt đầu.' : ''}
          </div>
        ) : (
          <DataTable
            rows={result.data}
            rowKey={rowId}
            columns={[
              ...columns.map((column) => ({
                key: column.key,
                header: column.label,
                render: column.render ?? ((row: Row) => label(row[column.key])),
              })),
              {
                key: 'actions',
                header: 'THAO TÁC',
                render: (row) => (
                  <div className="ops-actions">
                    {actions?.(row, reload)}
                    {allowed(canEdit, row) ? (
                      <Button
                        variant="quiet"
                        size="small"
                        onClick={() => {
                          setNotice('');
                          setEditor(row);
                        }}
                      >
                        Sửa
                      </Button>
                    ) : null}
                    {allowed(canDelete, row) ? (
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => {
                          setNotice('');
                          setDeleting(row);
                        }}
                      >
                        Xóa
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        )}
        {paginated && result && !error ? (
          <div className="table-footer">
            <span>{result.total ?? result.data.length} kết quả</span>
            <div className="pagination">
              <Button
                variant="quiet"
                size="small"
                disabled={loading || page <= 1}
                onClick={() => setPage((v) => v - 1)}
              >
                Trước
              </Button>
              <span>
                Trang {page} /{' '}
                {Math.max(1, Math.ceil((result.total ?? 0) / 20))}
              </span>
              <Button
                variant="quiet"
                size="small"
                disabled={loading || page * 20 >= (result.total ?? 0)}
                onClick={() => setPage((v) => v + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        ) : null}
      </Panel>
      {editor ? (
        <Editor
          title={`${editor === 'new' ? 'Thêm' : 'Cập nhật'} · ${title}`}
          fields={fields}
          row={editor === 'new' ? undefined : editor}
          prepare={prepare}
          onClose={() => setEditor(null)}
          onSave={async (body) => {
            await api(
              editor === 'new'
                ? createPath
                : `${path}/${encodeURIComponent(rowId(editor))}`,
              editor === 'new' ? 'POST' : 'PUT',
              body,
            );
            changed('Đã lưu thay đổi.');
          }}
        />
      ) : null}
      {deleting ? (
        <Confirm
          title={`Xóa · ${title}`}
          description={`Xác nhận xóa “${label(deleting.name ?? deleting.title ?? deleting.full_name ?? rowId(deleting))}”? Thao tác có thể bị từ chối nếu dữ liệu đang được sử dụng.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api(
              `${path}/${encodeURIComponent(rowId(deleting))}`,
              'DELETE',
            );
            changed('Đã xóa dữ liệu.');
          }}
        />
      ) : null}
    </>
  );
}
