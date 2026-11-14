import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';

import {
  clinicStructureApi,
  type Branch,
  type BranchInput,
  type BranchUpdate,
  type Department,
  type DepartmentInput,
  type DepartmentUpdate,
  type Room,
  type RoomInput,
  type RoomUpdate,
} from './clinic-structure-api';

type Props = {
  session: Session;
  role: 'admin' | 'doctor';
};

type ClinicKind = 'branch' | 'department' | 'room';
type ClinicEntity = Branch | Department | Room;
type ParentEntity = Branch | Department;
type EditorMode = 'create' | 'edit' | null;
type FormValues = {
  name: string;
  address: string;
  phone: string;
  description: string;
  parentId: string;
};

const kindLabels: Record<ClinicKind, string> = {
  branch: 'Chi nhánh',
  department: 'Khoa',
  room: 'Phòng',
};

const emptyForm: FormValues = {
  name: '',
  address: '',
  phone: '',
  description: '',
  parentId: '',
};

function listFor(
  kind: ClinicKind,
  session: Session,
  parentId: number | null,
): Promise<ClinicEntity[]> {
  if (kind === 'branch') return clinicStructureApi.listBranches(session);
  if (kind === 'department') return clinicStructureApi.listDepartments(session, parentId ?? undefined);
  return clinicStructureApi.listRooms(session, parentId ?? undefined);
}

function parentsFor(kind: ClinicKind, session: Session): Promise<ParentEntity[]> {
  if (kind === 'department') return clinicStructureApi.listBranches(session);
  if (kind === 'room') return clinicStructureApi.listDepartments(session);
  return Promise.resolve([]);
}

function detailFor(
  kind: ClinicKind,
  session: Session,
  id: number,
): Promise<ClinicEntity> {
  if (kind === 'branch') return clinicStructureApi.getBranch(session, id);
  if (kind === 'department') return clinicStructureApi.getDepartment(session, id);
  return clinicStructureApi.getRoom(session, id);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.';
}

function parentIdFor(kind: ClinicKind, entity: ClinicEntity): number | null {
  if (kind === 'department') return (entity as Department).branch_id;
  if (kind === 'room') return (entity as Room).department_id ?? null;
  return null;
}

function subtitleFor(kind: ClinicKind, entity: ClinicEntity, parents: ParentEntity[]): string {
  if (kind === 'branch') {
    const branch = entity as Branch;
    return [branch.address, branch.phone].filter(Boolean).join(' · ') || `Mã ${branch.id}`;
  }
  const parentId = parentIdFor(kind, entity);
  const parent = parents.find((item) => item.id === parentId);
  return `${parent ? parent.name : `Mã liên kết ${parentId ?? '—'}`} · Mã ${entity.id}`;
}

function initialValues(kind: ClinicKind, entity: ClinicEntity | null): FormValues {
  if (!entity) return emptyForm;
  return {
    name: entity.name,
    address: kind === 'branch' ? (entity as Branch).address ?? '' : '',
    phone: kind === 'branch' ? (entity as Branch).phone ?? '' : '',
    description: kind === 'branch' ? '' : (entity as Department | Room).description ?? '',
    parentId: String(parentIdFor(kind, entity) ?? ''),
  };
}

export function ClinicStructureScreen({ session, role }: Props) {
  const { width } = useWindowDimensions();
  const isAdmin = role === 'admin';
  const [kind, setKind] = useState<ClinicKind>('branch');
  const [items, setItems] = useState<ClinicEntity[]>([]);
  const [parents, setParents] = useState<ParentEntity[]>([]);
  const [selected, setSelected] = useState<ClinicEntity | null>(null);
  const [filterParentId, setFilterParentId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      listFor(kind, session, filterParentId),
      parentsFor(kind, session),
    ])
      .then(([nextItems, nextParents]) => {
        if (!active) return;
        setItems(nextItems);
        setParents(nextParents);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorText(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filterParentId, kind, reloadKey, session]);

  function chooseKind(nextKind: ClinicKind) {
    setLoading(true);
    setKind(nextKind);
    setFilterParentId(null);
    setSelected(null);
    setEditorMode(null);
    setConfirmDeleteId(null);
    setNotice(null);
    setError(null);
  }

  function chooseParentFilter(parentId: number | null) {
    setLoading(true);
    setFilterParentId(parentId);
    setSelected(null);
    setEditorMode(null);
    setConfirmDeleteId(null);
    setNotice(null);
    setError(null);
  }

  async function openDetail(item: ClinicEntity) {
    setSelected(item);
    setEditorMode(null);
    setConfirmDeleteId(null);
    setNotice(null);
    setError(null);
    setDetailLoading(true);
    try {
      const detail = await detailFor(kind, session, item.id);
      setSelected(detail);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setDetailLoading(false);
    }
  }

  function startCreate() {
    setSelected(null);
    setEditorMode('create');
    setForm({ ...emptyForm, parentId: filterParentId ? String(filterParentId) : '' });
    setNotice(null);
    setError(null);
    setConfirmDeleteId(null);
  }

  function startEdit() {
    if (!selected) return;
    setForm(initialValues(kind, selected));
    setEditorMode('edit');
    setNotice(null);
    setError(null);
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditorMode(null);
    setError(null);
    if (selected) setForm(initialValues(kind, selected));
  }

  function setField(field: keyof FormValues, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Vui lòng nhập tên.';
    if (kind === 'branch' && !form.address.trim()) return 'Vui lòng nhập địa chỉ chi nhánh.';
    if (kind === 'branch' && !form.phone.trim()) return 'Vui lòng nhập số điện thoại.';
    if (kind !== 'branch') {
      const parentId = Number(form.parentId);
      if (!Number.isInteger(parentId) || !parents.some((parent) => parent.id === parentId)) {
        return kind === 'department'
          ? 'Hãy chọn chi nhánh từ dữ liệu máy chủ.'
          : 'Hãy chọn khoa từ dữ liệu máy chủ.';
      }
    }
    return null;
  }

  async function save() {
    const validationMessage = validateForm();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    const name = form.name.trim();
    const description = form.description.trim();
    try {
      let saved: ClinicEntity;
      if (kind === 'branch') {
        const input: BranchInput = {
          name,
          address: form.address.trim(),
          phone: form.phone.trim(),
        };
        saved = editorMode === 'edit' && selected
          ? await clinicStructureApi.updateBranch(session, selected.id, input as BranchUpdate)
          : await clinicStructureApi.createBranch(session, input);
      } else if (kind === 'department') {
        const input: DepartmentInput = {
          name,
          branch_id: Number(form.parentId),
          ...(description ? { description } : {}),
        };
        saved = editorMode === 'edit' && selected
          ? await clinicStructureApi.updateDepartment(session, selected.id, input as DepartmentUpdate)
          : await clinicStructureApi.createDepartment(session, input);
      } else {
        const input: RoomInput = {
          name,
          department_id: Number(form.parentId),
          ...(description ? { description } : {}),
        };
        saved = editorMode === 'edit' && selected
          ? await clinicStructureApi.updateRoom(session, selected.id, input as RoomUpdate)
          : await clinicStructureApi.createRoom(session, input);
      }
      setSelected(saved);
      setEditorMode(null);
      setConfirmDeleteId(null);
      setNotice(`${kindLabels[kind]} đã được máy chủ lưu thành công.`);
      setLoading(true);
      setReloadKey((current) => current + 1);
    } catch (cause) {
      // Keep the editor values so rejected changes remain visibly unsaved and can be corrected.
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'branch') await clinicStructureApi.deleteBranch(session, selected.id);
      else if (kind === 'department') await clinicStructureApi.deleteDepartment(session, selected.id);
      else await clinicStructureApi.deleteRoom(session, selected.id);
      setSelected(null);
      setConfirmDeleteId(null);
      setEditorMode(null);
      setNotice(`${kindLabels[kind]} đã được máy chủ xác nhận xoá.`);
      setLoading(true);
      setReloadKey((current) => current + 1);
    } catch (cause) {
      // Keep the selected item visible; dependency and permission failures come from the API.
      setError(errorText(cause));
    } finally {
      setDeleting(false);
    }
  }

  function showRelatedItems(parentId: number, nextKind: ClinicKind) {
    setSelected(null);
    setEditorMode(null);
    setKind(nextKind);
    setFilterParentId(parentId);
    setLoading(true);
    setNotice(null);
    setError(null);
  }

  const detailTitle = selected?.name ?? '';
  const parentLabel = kind === 'department' ? 'Chi nhánh' : 'Khoa';
  const selectedParentId = selected ? parentIdFor(kind, selected) : null;
  const selectedParent = parents.find((parent) => parent.id === selectedParentId);
  const showTwoColumns = width >= 980;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MAY DAY / QUẢN LÝ CƠ SỞ</Text>
        <Text style={styles.title}>Cơ sở khám</Text>
        <Text style={styles.subtitle}>
          {isAdmin
            ? 'Quản lý chi nhánh, khoa và phòng. Kết quả chỉ được xác nhận sau phản hồi thành công từ máy chủ.'
            : 'Tra cứu chi nhánh, khoa và phòng theo dữ liệu mà máy chủ cho phép.'}
        </Text>

        <View accessibilityRole="tablist" style={styles.tabs}>
          {(['branch', 'department', 'room'] as const).map((item) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: item === kind }}
              key={item}
              onPress={() => chooseKind(item)}
              style={[styles.tab, kind === item && styles.tabActive]}>
              <Text style={[styles.tabText, kind === item && styles.tabTextActive]}>
                {kindLabels[item]}
              </Text>
            </Pressable>
          ))}
        </View>

        {kind !== 'branch' ? (
          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>Lọc theo {parentLabel.toLowerCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <ChoiceChip
                label={`Tất cả ${kindLabels[kind].toLowerCase()}`}
                selected={filterParentId === null}
                onPress={() => chooseParentFilter(null)}
              />
              {parents.map((parent) => (
                <ChoiceChip
                  key={parent.id}
                  label={parent.name}
                  selected={filterParentId === parent.id}
                  onPress={() => chooseParentFilter(parent.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {error ? <MessageBox tone="error" message={error} /> : null}
        {notice ? <MessageBox tone="success" message={notice} /> : null}

        <View style={[styles.columns, showTwoColumns && styles.columnsWide]}>
          <View style={[styles.panel, showTwoColumns && styles.listPanel]}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>{kindLabels[kind]} đã đăng ký</Text>
                <Text style={styles.panelHint}>{items.length} mục do máy chủ trả về</Text>
              </View>
              {isAdmin ? (
                <ActionButton label={`+ Thêm ${kindLabels[kind].toLowerCase()}`} onPress={startCreate} />
              ) : null}
            </View>

            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator color={appColors.primary} />
                <Text style={styles.mutedText}>Đang tải dữ liệu từ máy chủ…</Text>
              </View>
            ) : items.length ? (
              <View style={styles.itemList}>
                {items.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: selected?.id === item.id }}
                    key={item.id}
                    onPress={() => void openDetail(item)}
                    style={[styles.item, selected?.id === item.id && styles.itemSelected]}>
                    <View style={styles.itemCopy}>
                      <Text style={styles.itemTitle}>{item.name}</Text>
                      <Text style={styles.itemSubtitle}>{subtitleFor(kind, item, parents)}</Text>
                    </View>
                    <Text style={styles.itemArrow}>›</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Chưa có dữ liệu</Text>
                <Text style={styles.mutedText}>
                  {error ? 'Không thể xác nhận danh sách. Hãy thử tải lại.' : 'Máy chủ chưa trả về mục nào cho bộ lọc này.'}
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={() => {
                setLoading(true);
                setError(null);
                setReloadKey((current) => current + 1);
              }}
              style={styles.refreshButton}>
              <Text style={styles.refreshText}>Tải lại từ máy chủ</Text>
            </Pressable>
          </View>

          <View style={[styles.panel, showTwoColumns && styles.detailPanel]}>
            {editorMode ? (
              <Editor
                kind={kind}
                mode={editorMode}
                values={form}
                parents={parents}
                parentLabel={parentLabel}
                busy={saving}
                onChange={setField}
                onSave={() => void save()}
                onCancel={cancelEdit}
              />
            ) : selected ? (
              <View>
                <Text style={styles.detailEyebrow}>{kindLabels[kind].toUpperCase()} / MÃ {selected.id}</Text>
                <Text style={styles.detailTitle}>{detailTitle}</Text>
                {detailLoading ? (
                  <View style={styles.detailLoading}>
                    <ActivityIndicator color={appColors.primary} />
                    <Text style={styles.mutedText}>Đang xác minh chi tiết…</Text>
                  </View>
                ) : (
                  <EntityDetails
                    kind={kind}
                    entity={selected}
                    parent={selectedParent}
                    onShowRelated={showRelatedItems}
                  />
                )}
                {isAdmin && !detailLoading ? (
                  <View style={styles.actions}>
                    <ActionButton label="Chỉnh sửa" onPress={startEdit} />
                    {confirmDeleteId === selected.id ? (
                      <View style={styles.confirmBox}>
                        <Text style={styles.confirmText}>
                          Xác nhận xoá? Máy chủ sẽ kiểm tra các quan hệ và có thể từ chối nếu còn dữ liệu phụ thuộc.
                        </Text>
                        <View style={styles.buttonRow}>
                          <ActionButton
                            label={deleting ? 'Đang gửi…' : 'Xác nhận xoá'}
                            destructive
                            disabled={deleting}
                            onPress={() => void deleteSelected()}
                          />
                          <ActionButton
                            label="Huỷ"
                            secondary
                            disabled={deleting}
                            onPress={() => setConfirmDeleteId(null)}
                          />
                        </View>
                      </View>
                    ) : (
                      <ActionButton
                        label="Xoá"
                        destructive
                        onPress={() => {
                          setError(null);
                          setConfirmDeleteId(selected.id);
                        }}
                      />
                    )}
                  </View>
                ) : null}
              </View>
            ) : editorMode === null ? (
              <View style={styles.detailEmpty}>
                <Text style={styles.emptyTitle}>Chọn một mục để xem chi tiết</Text>
                <Text style={styles.mutedText}>
                  Chi tiết được tải riêng từ API; quyền tạo, sửa và xoá chỉ hiển thị với quản trị viên.
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Editor({
  kind,
  mode,
  values,
  parents,
  parentLabel,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  kind: ClinicKind;
  mode: Exclude<EditorMode, null>;
  values: FormValues;
  parents: ParentEntity[];
  parentLabel: string;
  busy: boolean;
  onChange: (field: keyof FormValues, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const selectedParentId = Number(values.parentId);
  return (
    <View>
      <Text style={styles.detailEyebrow}>{mode === 'create' ? 'TẠO MỚI' : 'CHỈNH SỬA'}</Text>
      <Text style={styles.detailTitle}>{mode === 'create' ? `Thêm ${kindLabels[kind].toLowerCase()}` : 'Cập nhật thông tin'}</Text>
      <Field
        label={`Tên ${kindLabels[kind].toLowerCase()}`}
        value={values.name}
        onChangeText={(text) => onChange('name', text)}
        editable={!busy}
      />
      {kind === 'branch' ? (
        <>
          <Field label="Địa chỉ" value={values.address} onChangeText={(text) => onChange('address', text)} editable={!busy} />
          <Field label="Số điện thoại" value={values.phone} onChangeText={(text) => onChange('phone', text)} editable={!busy} keyboardType="phone-pad" />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>{parentLabel} từ dữ liệu máy chủ</Text>
          {parents.length ? (
            <View style={styles.parentOptions}>
              {parents.map((parent) => (
                <ChoiceChip
                  key={parent.id}
                  label={parent.name}
                  selected={selectedParentId === parent.id}
                  onPress={() => onChange('parentId', String(parent.id))}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.mutedText}>Không có {parentLabel.toLowerCase()} nào được máy chủ trả về.</Text>
          )}
          <Field label="Mô tả (không bắt buộc)" value={values.description} onChangeText={(text) => onChange('description', text)} editable={!busy} multiline />
        </>
      )}
      <View style={styles.buttonRow}>
        <ActionButton label={busy ? 'Đang lưu…' : 'Lưu thay đổi'} disabled={busy} onPress={onSave} />
        <ActionButton label="Huỷ" secondary disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  editable,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  editable: boolean;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={editable}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={appColors.muted}
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

function EntityDetails({
  kind,
  entity,
  parent,
  onShowRelated,
}: {
  kind: ClinicKind;
  entity: ClinicEntity;
  parent: ParentEntity | undefined;
  onShowRelated: (parentId: number, nextKind: ClinicKind) => void;
}) {
  const details: [string, string][] = [['Tên', entity.name]];
  if (kind === 'branch') {
    const branch = entity as Branch;
    details.push(['Địa chỉ', branch.address || 'Chưa có dữ liệu']);
    details.push(['Số điện thoại', branch.phone || 'Chưa có dữ liệu']);
  } else {
    const related = entity as Department | Room;
    details.push(['Mô tả', related.description || 'Chưa có mô tả']);
    details.push([kind === 'department' ? 'Chi nhánh' : 'Khoa', parent?.name ?? `Mã ${parentIdFor(kind, entity) ?? 'không được liên kết'}`]);
  }
  if (entity.created_at) details.push(['Ngày tạo', new Date(entity.created_at).toLocaleString()]);
  if (entity.updated_at) details.push(['Cập nhật', new Date(entity.updated_at).toLocaleString()]);

  return (
    <View style={styles.details}>
      {details.map(([label, value]) => (
        <View key={label} style={styles.detailRow}>
          <Text style={styles.detailLabel}>{label}</Text>
          <Text style={styles.detailValue}>{value}</Text>
        </View>
      ))}
      {kind === 'branch' ? (
        <ActionButton
          label="Xem các khoa thuộc chi nhánh"
          secondary
          onPress={() => onShowRelated(entity.id, 'department')}
        />
      ) : kind === 'department' ? (
        <ActionButton
          label="Xem các phòng thuộc khoa"
          secondary
          onPress={() => onShowRelated(entity.id, 'room')}
        />
      ) : null}
    </View>
  );
}

function MessageBox({ message, tone }: { message: string; tone: 'error' | 'success' }) {
  return (
    <View accessibilityRole={tone === 'error' ? 'alert' : 'summary'} style={[styles.message, tone === 'error' ? styles.errorMessage : styles.successMessage]}>
      <Text style={tone === 'error' ? styles.errorText : styles.successText}>{message}</Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  secondary = false,
  destructive = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.secondaryButton,
        destructive && styles.destructiveButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.actionText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 1200, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 42, gap: 16 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: -7, color: appColors.ink, fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: -7, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  tab: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 13, backgroundColor: appColors.surface, paddingHorizontal: 17 },
  tabActive: { borderColor: appColors.primary, backgroundColor: appColors.primary },
  tabText: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: appColors.surface },
  filterCard: { borderWidth: 1, borderColor: appColors.border, borderRadius: 16, backgroundColor: appColors.surface, padding: 14, gap: 10 },
  filterLabel: { color: appColors.ink, fontSize: 13, fontWeight: '700' },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 999, backgroundColor: appColors.surface, paddingHorizontal: 13 },
  chipSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  chipText: { color: appColors.ink, fontSize: 12, fontWeight: '700' },
  chipTextSelected: { color: appColors.primaryDark },
  columns: { gap: 16, alignItems: 'stretch' },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  panel: { minWidth: 0, borderWidth: 1, borderColor: appColors.border, borderRadius: 20, backgroundColor: appColors.surface, padding: 18 },
  listPanel: { flex: 0.9 },
  detailPanel: { flex: 1.1 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  panelHeading: { flex: 1, minWidth: 150 },
  panelTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  panelHint: { marginTop: 5, color: appColors.muted, fontSize: 12 },
  itemList: { marginTop: 15, gap: 9 },
  item: { minHeight: 67, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 14, backgroundColor: appColors.surface, paddingHorizontal: 14, paddingVertical: 11 },
  itemSelected: { borderColor: appColors.primary, backgroundColor: appColors.primarySoft },
  itemCopy: { flex: 1 },
  itemTitle: { color: appColors.ink, fontSize: 14, fontWeight: '800' },
  itemSubtitle: { marginTop: 4, color: appColors.muted, fontSize: 12, lineHeight: 17 },
  itemArrow: { marginLeft: 8, color: appColors.primary, fontSize: 23 },
  loading: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 8 },
  empty: { minHeight: 110, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 6 },
  emptyTitle: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  mutedText: { color: appColors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  refreshButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderRadius: 12, backgroundColor: appColors.canvas, paddingHorizontal: 12 },
  refreshText: { color: appColors.primaryDark, fontSize: 13, fontWeight: '800' },
  detailEmpty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 8 },
  detailEyebrow: { color: appColors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  detailTitle: { marginTop: 9, marginBottom: 15, color: appColors.ink, fontSize: 22, fontWeight: '800' },
  detailLoading: { minHeight: 90, alignItems: 'center', justifyContent: 'center', gap: 8 },
  details: { gap: 4 },
  detailRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: appColors.border },
  detailLabel: { color: appColors.muted, fontSize: 12, fontWeight: '700' },
  detailValue: { marginTop: 4, color: appColors.ink, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 9, marginTop: 18 },
  actionButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: appColors.primary, paddingHorizontal: 15, paddingVertical: 9 },
  secondaryButton: { backgroundColor: appColors.canvas },
  destructiveButton: { backgroundColor: '#B42318' },
  disabledButton: { opacity: 0.55 },
  actionText: { color: appColors.surface, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  secondaryText: { color: appColors.primaryDark },
  pressed: { opacity: 0.76 },
  confirmBox: { flexBasis: '100%', borderWidth: 1, borderColor: '#F3B7B0', borderRadius: 13, backgroundColor: '#FFF5F4', padding: 12, gap: 10 },
  confirmText: { color: '#7A271A', fontSize: 13, lineHeight: 19 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  field: { marginTop: 13, gap: 6 },
  fieldLabel: { color: appColors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, backgroundColor: appColors.surface, paddingHorizontal: 12, color: appColors.ink, fontSize: 14 },
  multilineInput: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
  parentOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  message: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  errorMessage: { borderColor: '#F3B7B0', backgroundColor: '#FFF5F4' },
  successMessage: { borderColor: '#A6F4C5', backgroundColor: '#ECFDF3' },
  errorText: { color: '#7A271A', fontSize: 13, lineHeight: 19 },
  successText: { color: '#05603A', fontSize: 13, lineHeight: 19 },
});
