import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiRequestError } from '@/api/client';
import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import { clinicStructureApi, type Branch, type Department, type Room } from '@/features/clinic-structure/clinic-structure-api';

import {
  adminUsersApi,
  type AdminUserDetail,
  type AdminUserListItem,
  type AssignStaffInput,
  type CreateAdminUserInput,
  type CreateStaffInput,
  type UpdateAdminUserInput,
} from './admin-users-api';
import { accessControlApi, type AccessRole } from './access-control-api';

const PAGE_SIZE = 20;
type Editor = 'create-user' | 'create-staff' | 'edit-user' | 'assign-staff' | null;
type Gender = 'male' | 'female' | 'other';
type Draft = {
  fullName: string;
  phone: string;
  password: string;
  gender: '' | Gender;
  roleId: string;
  active: boolean;
  branchId: string;
  departmentId: string;
  roomId: string;
};

const emptyDraft: Draft = {
  fullName: '',
  phone: '',
  password: '',
  gender: '',
  roleId: '',
  active: true,
  branchId: '',
  departmentId: '',
  roomId: '',
};

function errorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const status = error.status === null ? '' : ` · HTTP ${error.status}`;
    const code = error.apiCode ? ` · API ${error.apiCode}` : '';
    return `${error.operation}: ${error.message}${status}${code}`;
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.';
}

function isStaffDetail(user: AdminUserDetail): boolean {
  return 'branch_id' in user || 'department_id' in user || 'room_id' in user;
}

function parseId(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  secureTextEntry,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChange}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function OptionChips<T extends { id: number; name: string }>({
  label,
  items,
  selectedId,
  onSelect,
  allowNone = false,
  emptyMessage = 'Máy chủ chưa trả về lựa chọn.',
}: {
  label: string;
  items: T[];
  selectedId: number | null;
  onSelect(id: number | null): void;
  allowNone?: boolean;
  emptyMessage?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionList}>
        {allowNone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === null }}
            onPress={() => onSelect(null)}
            style={[styles.option, selectedId === null && styles.selectedOption]}>
            <Text style={[styles.optionText, selectedId === null && styles.selectedOptionText]}>Chưa chọn</Text>
          </Pressable>
        ) : null}
        {items.map((item) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: selectedId === item.id }}
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.option, selectedId === item.id && styles.selectedOption]}>
            <Text style={[styles.optionText, selectedId === item.id && styles.selectedOptionText]}>
              {item.name}
            </Text>
          </Pressable>
        ))}
        {items.length === 0 && !allowNone ? (
          <Text style={styles.mutedText}>{emptyMessage}</Text>
        ) : null}
      </View>
    </View>
  );
}

export function AdminUsersScreen({ session }: { session: Session }) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<AdminUserListItem | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailReloadKey, setDetailReloadKey] = useState(0);

  const [editor, setEditor] = useState<Editor>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let active = true;
    adminUsersApi.listUsers(session, { page, limit: PAGE_SIZE })
      .then((response) => {
        if (!active) return;
        setUsers(response.data);
        setTotal(response.total);
      })
      .catch((cause: unknown) => {
        if (active) setListError(errorText(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, reloadKey, session]);

  useEffect(() => {
    if (selectedId === null) return;
    let active = true;
    adminUsersApi.getUser(session, selectedId)
      .then((response) => {
        if (active) setDetail(response);
      })
      .catch((cause: unknown) => {
        if (active) setDetailError(errorText(cause));
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detailReloadKey, selectedId, session]);

  function reloadList() {
    setLoading(true);
    setListError(null);
    setReloadKey((value) => value + 1);
  }

  async function loadRoleOptions() {
    const roleOptions = await accessControlApi.listRoles(session);
    setRoles(roleOptions);
  }

  async function loadBranchOptions() {
    const branchOptions = await clinicStructureApi.listBranches(session);
    setBranches(branchOptions);
    return branchOptions;
  }

  function resetEditor() {
    setEditor(null);
    setDraft(emptyDraft);
    setOptionsError(null);
    setActionError(null);
    setOptionsLoading(false);
  }

  function beginCreateUser() {
    setEditor('create-user');
    setDraft(emptyDraft);
    setOptionsError(null);
    setActionError(null);
    setNotice(null);
    setConfirmDelete(false);
    setOptionsLoading(true);
    loadRoleOptions()
      .catch((cause: unknown) => setOptionsError(errorText(cause)))
      .finally(() => setOptionsLoading(false));
  }

  function beginCreateStaff() {
    setEditor('create-staff');
    setDraft(emptyDraft);
    setDepartments([]);
    setRooms([]);
    setOptionsError(null);
    setActionError(null);
    setNotice(null);
    setConfirmDelete(false);
    setOptionsLoading(true);
    Promise.all([loadRoleOptions(), loadBranchOptions()])
      .catch((cause: unknown) => setOptionsError(errorText(cause)))
      .finally(() => setOptionsLoading(false));
  }

  function beginEdit() {
    if (!detail) return;
    setEditor('edit-user');
    setDraft({
      ...emptyDraft,
      fullName: detail.full_name,
      gender: detail.gender ?? '',
      roleId: String(detail.role_id),
      active: (detail.is_active ?? selectedSummary?.is_active) === 1,
    });
    setActionError(null);
    setOptionsError(null);
    setNotice(null);
    setConfirmDelete(false);
    setOptionsLoading(true);
    loadRoleOptions()
      .catch((cause: unknown) => setOptionsError(errorText(cause)))
      .finally(() => setOptionsLoading(false));
  }

  function beginAssignStaff() {
    if (!detail || !isStaffDetail(detail)) return;
    const branchId = detail.branch_id ?? null;
    const departmentId = detail.department_id ?? null;
    setEditor('assign-staff');
    setDraft({
      ...emptyDraft,
      branchId: branchId === null ? '' : String(branchId),
      departmentId: departmentId === null ? '' : String(departmentId),
      roomId: detail.room_id == null ? '' : String(detail.room_id),
    });
    setActionError(null);
    setOptionsError(null);
    setNotice(null);
    setConfirmDelete(false);
    setDepartments([]);
    setRooms([]);
    setOptionsLoading(true);
    const dependentOptions = Promise.all([
      branchId === null ? Promise.resolve([] as Department[]) : clinicStructureApi.listDepartments(session, branchId),
      departmentId === null ? Promise.resolve([] as Room[]) : clinicStructureApi.listRooms(session, departmentId),
    ]);
    Promise.all([loadBranchOptions(), dependentOptions])
      .then(([, [departmentOptions, roomOptions]]) => {
        setDepartments(departmentOptions);
        setRooms(roomOptions);
      })
      .catch((cause: unknown) => setOptionsError(errorText(cause)))
      .finally(() => setOptionsLoading(false));
  }

  async function selectBranch(branchId: number | null) {
    setDraft((current) => ({
      ...current,
      branchId: branchId === null ? '' : String(branchId),
      departmentId: '',
      roomId: '',
    }));
    setDepartments([]);
    setRooms([]);
    setOptionsError(null);
    if (branchId === null) return;
    setOptionsLoading(true);
    try {
      setDepartments(await clinicStructureApi.listDepartments(session, branchId));
    } catch (cause) {
      setOptionsError(errorText(cause));
    } finally {
      setOptionsLoading(false);
    }
  }

  async function selectDepartment(departmentId: number | null) {
    setDraft((current) => ({
      ...current,
      departmentId: departmentId === null ? '' : String(departmentId),
      roomId: '',
    }));
    setRooms([]);
    setOptionsError(null);
    if (departmentId === null) return;
    setOptionsLoading(true);
    try {
      setRooms(await clinicStructureApi.listRooms(session, departmentId));
    } catch (cause) {
      setOptionsError(errorText(cause));
    } finally {
      setOptionsLoading(false);
    }
  }

  function validateDraft(): string | null {
    if (editor !== 'assign-staff' && !draft.fullName.trim()) return 'Nhập họ và tên.';
    if (!/^(03|05|07|08|09)\d{8}$/.test(draft.phone.trim()) && (editor === 'create-user' || editor === 'create-staff')) {
      return 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 03, 05, 07, 08 hoặc 09.';
    }
    if ((editor === 'create-user' || editor === 'create-staff') && draft.password.length < 6) {
      return 'Mật khẩu phải có ít nhất 6 ký tự.';
    }
    if (editor !== 'assign-staff' && !parseId(draft.roleId)) return 'Chọn vai trò do máy chủ cung cấp.';
    if (editor === 'edit-user' && !draft.gender && detail?.gender) {
      return 'Hợp đồng API không cho phép xoá giới tính đã lưu; hãy chọn một giá trị hợp lệ.';
    }
    if (editor === 'create-staff' || editor === 'assign-staff') {
      if (!parseId(draft.branchId) || !parseId(draft.departmentId)) {
        return 'Chọn chi nhánh và khoa từ danh sách do máy chủ cung cấp.';
      }
      if (draft.roomId && !parseId(draft.roomId)) return 'Phòng được chọn không hợp lệ.';
    }
    return null;
  }

  function changedUserFields(): UpdateAdminUserInput {
    if (!detail) return {};
    const changes: UpdateAdminUserInput = {};
    const fullName = draft.fullName.trim();
    const roleId = parseId(draft.roleId);
    const gender = draft.gender || undefined;
    if (fullName !== detail.full_name) changes.full_name = fullName;
    if (roleId !== null && roleId !== detail.role_id) changes.role_id = roleId;
    if (gender && gender !== (detail.gender ?? undefined)) changes.gender = gender;
    const isActive: 0 | 1 = draft.active ? 1 : 0;
    const originalActive = detail.is_active ?? selectedSummary?.is_active;
    if (originalActive !== undefined && isActive !== originalActive) changes.is_active = isActive;
    return changes;
  }

  async function submitEditor() {
    const validation = validateDraft();
    if (validation) {
      setActionError(validation);
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      if (editor === 'create-user') {
        const input: CreateAdminUserInput = {
          full_name: draft.fullName.trim(),
          phone: draft.phone.trim(),
          password: draft.password,
          role_id: parseId(draft.roleId)!,
          is_active: draft.active ? 1 : 0,
          ...(draft.gender ? { gender: draft.gender } : {}),
        };
        const created = await adminUsersApi.createUser(session, input);
        setNotice(`Máy chủ đã xác nhận tạo tài khoản “${created.full_name}”.`);
        setSelectedSummary(created);
        setSelectedId(created.user_id);
        setDetail(null);
        setDetailLoading(true);
      } else if (editor === 'create-staff') {
        const input: CreateStaffInput = {
          full_name: draft.fullName.trim(),
          phone: draft.phone.trim(),
          password: draft.password,
          role_id: parseId(draft.roleId)!,
          branch_id: parseId(draft.branchId)!,
          department_id: parseId(draft.departmentId)!,
          ...(draft.gender ? { gender: draft.gender } : {}),
          ...(parseId(draft.roomId) ? { room_id: parseId(draft.roomId)! } : {}),
        };
        const created = await adminUsersApi.createStaff(session, input);
        setNotice(`Máy chủ đã xác nhận tạo nhân viên “${created.full_name}”.`);
        setSelectedSummary(null);
        setSelectedId(created.user_id);
        setDetail(created);
      } else if (editor === 'edit-user' && detail) {
        const changes = changedUserFields();
        if (Object.keys(changes).length === 0) {
          setActionError('Chưa có thay đổi để lưu.');
          return;
        }
        const updated = await adminUsersApi.updateUser(session, detail.user_id, changes);
        setNotice(`Máy chủ đã xác nhận cập nhật “${updated.full_name}”.`);
        setDetail(updated);
        setSelectedSummary((current) => current ? ({
          ...current,
          full_name: updated.full_name,
          role_id: updated.role_id,
          is_active: updated.is_active ?? changes.is_active ?? current.is_active,
        }) : current);
      } else if (editor === 'assign-staff' && detail) {
        const input: AssignStaffInput = {
          branch_id: parseId(draft.branchId)!,
          department_id: parseId(draft.departmentId)!,
          room_id: parseId(draft.roomId),
        };
        const assigned = await adminUsersApi.assignStaff(session, detail.user_id, input);
        setDetail({ ...detail, ...assigned });
        setNotice(`Máy chủ đã xác nhận phân công “${detail.full_name}”.`);
      } else {
        return;
      }

      resetEditor();
      setConfirmDelete(false);
      reloadList();
    } catch (cause) {
      setActionError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedUser() {
    if (!detail) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await adminUsersApi.deleteUser(session, detail.user_id);
      setNotice(`Máy chủ đã xác nhận xoá “${detail.full_name}”.`);
      setSelectedId(null);
      setSelectedSummary(null);
      setDetail(null);
      setConfirmDelete(false);
      resetEditor();
      reloadList();
    } catch (cause) {
      setActionError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function selectUser(user: AdminUserListItem) {
    setSelectedId(user.user_id);
    setSelectedSummary(user);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setEditor(null);
    setConfirmDelete(false);
    setActionError(null);
    setOptionsError(null);
  }

  const pageCount = total === undefined ? undefined : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentRole = roles.find((role) => role.id === parseId(draft.roleId));

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MAY DAY / QUẢN TRỊ</Text>
        <Text style={styles.title}>Người dùng và nhân viên</Text>
        <Text style={styles.subtitle}>
          Tài khoản, trạng thái và phân công chỉ thay đổi sau khi API xác nhận. Vai trò và vị trí lấy từ danh mục máy chủ.
        </Text>

        {notice ? <Text style={styles.successMessage}>{notice}</Text> : null}
        {actionError ? <Text accessibilityRole="alert" style={styles.errorMessage}>{actionError}</Text> : null}

        <View style={styles.topActions}>
          <Pressable accessibilityRole="button" onPress={beginCreateUser} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>＋ Tạo tài khoản</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={beginCreateStaff} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>＋ Tạo nhân viên</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={reloadList} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Làm mới</Text>
          </Pressable>
        </View>

        {editor ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>
              {editor === 'create-user' ? 'Tạo tài khoản' :
                editor === 'create-staff' ? 'Tạo tài khoản nhân viên' :
                  editor === 'edit-user' ? 'Cập nhật người dùng' : 'Phân công nhân viên'}
            </Text>
            {editor !== 'assign-staff' ? (
              <>
                <Field label="Họ và tên" value={draft.fullName} onChange={(value) => setDraft((current) => ({ ...current, fullName: value }))} />
                {editor !== 'edit-user' ? (
                  <>
                    <Field label="Số điện thoại" value={draft.phone} keyboardType="phone-pad" onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} />
                    <Field label="Mật khẩu (tối thiểu 6 ký tự)" value={draft.password} secureTextEntry onChange={(value) => setDraft((current) => ({ ...current, password: value }))} />
                  </>
                ) : null}
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Giới tính (tuỳ chọn)</Text>
                  <View style={styles.optionList}>
                    {([
                      ['', 'Không cung cấp'],
                      ['male', 'Nam'],
                      ['female', 'Nữ'],
                      ['other', 'Khác'],
                    ] as const).map(([value, label]) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: draft.gender === value }}
                        key={value || 'none'}
                        onPress={() => setDraft((current) => ({ ...current, gender: value }))}
                        style={[styles.option, draft.gender === value && styles.selectedOption]}>
                        <Text style={[styles.optionText, draft.gender === value && styles.selectedOptionText]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            ) : null}

            {editor !== 'assign-staff' ? (
              <OptionChips
                label="Vai trò"
                items={roles}
                selectedId={parseId(draft.roleId)}
                onSelect={(id) => setDraft((current) => ({ ...current, roleId: id === null ? '' : String(id) }))}
              />
            ) : null}

            {editor === 'create-user' || editor === 'edit-user' ? (
              editor === 'edit-user' && (detail?.is_active ?? selectedSummary?.is_active) === undefined ? (
                <Text style={styles.mutedText}>Trạng thái hoạt động chưa có trong dữ liệu API hiện tại.</Text>
              ) : (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: draft.active }}
                  onPress={() => setDraft((current) => ({ ...current, active: !current.active }))}
                  style={styles.checkboxRow}>
                  <View style={[styles.checkbox, draft.active && styles.checkboxChecked]}>
                    {draft.active ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxText}>Tài khoản đang hoạt động</Text>
                </Pressable>
              )
            ) : null}

            {editor === 'create-staff' || editor === 'assign-staff' ? (
              <>
                <OptionChips
                  label="Chi nhánh"
                  items={branches}
                  selectedId={parseId(draft.branchId)}
                  onSelect={(id) => void selectBranch(id)}
                />
                <OptionChips
                  label="Khoa"
                  items={departments}
                  selectedId={parseId(draft.departmentId)}
                  emptyMessage={draft.branchId ? 'Máy chủ chưa trả về khoa cho chi nhánh đã chọn.' : 'Chọn chi nhánh để tải danh sách khoa.'}
                  onSelect={(id) => void selectDepartment(id)}
                />
                <OptionChips
                  label="Phòng (tuỳ chọn)"
                  items={rooms}
                  selectedId={parseId(draft.roomId)}
                  allowNone
                  emptyMessage={draft.departmentId ? 'Máy chủ chưa trả về phòng cho khoa đã chọn.' : 'Chọn khoa để tải danh sách phòng.'}
                  onSelect={(id) => setDraft((current) => ({ ...current, roomId: id === null ? '' : String(id) }))}
                />
              </>
            ) : null}

            {currentRole ? <Text style={styles.mutedText}>Vai trò đang chọn: {currentRole.name}</Text> : null}
            {optionsLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={appColors.primary} />
                <Text style={styles.mutedText}>Đang tải lựa chọn từ máy chủ…</Text>
              </View>
            ) : null}
            {optionsError ? <Text accessibilityRole="alert" style={styles.errorMessage}>{optionsError}</Text> : null}
            <View style={styles.formActions}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={resetEditor} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Huỷ</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving || optionsLoading}
                onPress={() => void submitEditor()}
                style={[styles.primaryButton, (saving || optionsLoading) && styles.disabledButton]}>
                {saving ? <ActivityIndicator color={appColors.surface} /> : <Text style={styles.primaryButtonText}>Lưu</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <View style={styles.headingBlock}>
            <Text style={styles.sectionTitle}>Danh sách tài khoản</Text>
            <Text style={styles.sectionSubtitle}>
              {total === undefined ? `Trang ${page}` : `${total} tài khoản · trang ${page} / ${pageCount}`}
            </Text>
          </View>
          {loading ? <ActivityIndicator color={appColors.primary} /> : null}
        </View>

        {listError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Không thể tải người dùng</Text>
            <Text style={styles.errorBody}>{listError}</Text>
            <Pressable accessibilityRole="button" onPress={reloadList} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : loading && users.length === 0 ? (
          <View style={styles.loadingRow}><ActivityIndicator color={appColors.primary} /><Text style={styles.mutedText}>Đang tải tài khoản…</Text></View>
        ) : users.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.mutedText}>Máy chủ trả về danh sách trống.</Text></View>
        ) : (
          <View style={styles.list}>
            {users.map((user) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: selectedId === user.user_id }}
                key={user.user_id}
                onPress={() => selectUser(user)}
                style={[styles.userCard, selectedId === user.user_id && styles.selectedUserCard]}>
                <Text style={styles.userName}>{user.full_name}</Text>
                <Text style={styles.userMeta}>{user.phone} · Vai trò ID {user.role_id}</Text>
                <Text style={[styles.status, user.is_active === 1 ? styles.activeStatus : styles.inactiveStatus]}>
                  {user.is_active === 1 ? 'Đang hoạt động' : 'Đã khoá'}
                </Text>
                <Text style={styles.openHint}>Mở chi tiết →</Text>
              </Pressable>
            ))}
          </View>
        )}

        {pageCount !== undefined && pageCount > 1 ? (
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              disabled={page <= 1 || loading}
              onPress={() => { setPage((value) => Math.max(1, value - 1)); setLoading(true); setListError(null); }}
              style={[styles.pageButton, (page <= 1 || loading) && styles.disabledButton]}>
              <Text style={styles.secondaryButtonText}>Trước</Text>
            </Pressable>
            <Text style={styles.pageText}>Trang {page} / {pageCount}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={page >= pageCount || loading}
              onPress={() => { setPage((value) => Math.min(pageCount, value + 1)); setLoading(true); setListError(null); }}
              style={[styles.pageButton, (page >= pageCount || loading) && styles.disabledButton]}>
              <Text style={styles.secondaryButtonText}>Tiếp</Text>
            </Pressable>
          </View>
        ) : null}

        {selectedId !== null ? (
          <View style={styles.detailCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.headingBlock}>
                <Text style={styles.sectionTitle}>Chi tiết người dùng</Text>
                {detail ? <Text style={styles.sectionSubtitle}>{`${detail.full_name} · ${detail.phone}`}</Text> : null}
              </View>
              {detailLoading ? <ActivityIndicator color={appColors.primary} /> : null}
            </View>
            {detailError ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorBody}>{detailError}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setDetailLoading(true); setDetailError(null); setDetailReloadKey((value) => value + 1); }}
                  style={styles.retryButton}>
                  <Text style={styles.retryText}>Tải lại danh sách</Text>
                </Pressable>
              </View>
            ) : detail ? (
              <>
                <Text style={styles.detailLine}>Mã người dùng: {detail.user_id}</Text>
                <Text style={styles.detailLine}>Số điện thoại: {detail.phone}</Text>
                <Text style={styles.detailLine}>Vai trò ID: {detail.role_id}</Text>
                {detail.is_active !== undefined ? (
                  <Text style={styles.detailLine}>Trạng thái: {detail.is_active === 1 ? 'Đang hoạt động' : 'Đã khoá'}</Text>
                ) : null}
                {isStaffDetail(detail) ? (
                  <Text style={styles.detailLine}>
                    Phân công hiện tại: chi nhánh {detail.branch_id ?? 'chưa gán'} · khoa {detail.department_id ?? 'chưa gán'} · phòng {detail.room_id ?? 'chưa gán'}
                  </Text>
                ) : null}
                <View style={styles.detailActions}>
                  <Pressable accessibilityRole="button" onPress={beginEdit} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Sửa người dùng</Text>
                  </Pressable>
                  {isStaffDetail(detail) ? (
                    <Pressable accessibilityRole="button" onPress={beginAssignStaff} style={styles.secondaryButton}>
                      <Text style={styles.secondaryButtonText}>Phân công</Text>
                    </Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button" onPress={() => { setEditor(null); setConfirmDelete(true); setActionError(null); }} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>Xoá</Text>
                  </Pressable>
                </View>
              </>
            ) : detailLoading ? null : null}
          </View>
        ) : null}

        {confirmDelete && detail ? (
          <View style={styles.confirmCard}>
            <Text style={styles.cardTitle}>Xác nhận xoá người dùng</Text>
            <Text style={styles.errorBody}>
              Xoá “{detail.full_name}” sau khi máy chủ xác nhận. Người bệnh đã có bệnh án có thể không xoá được; hãy khoá tài khoản nếu API từ chối.
            </Text>
            <View style={styles.formActions}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => setConfirmDelete(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Huỷ</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void deleteSelectedUser()}
                style={[styles.deleteButton, saving && styles.disabledButton]}>
                {saving ? <ActivityIndicator color={appColors.surface} /> : <Text style={styles.deleteButtonText}>Xác nhận xoá</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 44 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  title: { marginTop: 12, color: appColors.ink, fontSize: 30, fontWeight: '800' },
  subtitle: { marginTop: 9, color: appColors.muted, fontSize: 14, lineHeight: 21 },
  topActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, marginTop: 20 },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: appColors.primary, paddingHorizontal: 16 },
  primaryButtonText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 11, backgroundColor: appColors.surface, paddingHorizontal: 13 },
  secondaryButtonText: { color: appColors.ink, fontSize: 13, fontWeight: '700' },
  refreshButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 9 },
  refreshText: { color: appColors.primary, fontSize: 13, fontWeight: '700' },
  successMessage: { marginTop: 15, padding: 13, borderRadius: 12, backgroundColor: '#E6F5ED', color: '#236443', fontSize: 13, lineHeight: 19 },
  errorMessage: { marginTop: 15, padding: 13, borderRadius: 12, backgroundColor: '#FCE9E8', color: '#9F3732', fontSize: 13, lineHeight: 19 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 25, marginBottom: 11 },
  headingBlock: { flex: 1, minWidth: 190 },
  sectionTitle: { color: appColors.ink, fontSize: 20, fontWeight: '800' },
  sectionSubtitle: { marginTop: 5, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  formCard: { marginTop: 20, borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface, padding: 18, gap: 14 },
  cardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800' },
  field: { width: '100%' },
  fieldLabel: { marginBottom: 7, color: appColors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderColor: appColors.border, borderRadius: 11, backgroundColor: '#FBFDFF', paddingHorizontal: 12, paddingVertical: 10, color: appColors.ink, fontSize: 14 },
  optionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 38, justifyContent: 'center', borderRadius: 999, backgroundColor: '#EAF0F5', paddingHorizontal: 13, paddingVertical: 8 },
  selectedOption: { backgroundColor: appColors.primary },
  optionText: { color: appColors.ink, fontSize: 12, fontWeight: '700' },
  selectedOptionText: { color: appColors.surface },
  checkboxRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 5 },
  checkboxChecked: { borderColor: appColors.primary, backgroundColor: appColors.primary },
  checkmark: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  checkboxText: { color: appColors.ink, fontSize: 13 },
  formActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9, marginTop: 5 },
  loadingRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  mutedText: { color: appColors.muted, fontSize: 13, lineHeight: 19 },
  disabledButton: { opacity: 0.5 },
  list: { gap: 10 },
  userCard: { borderWidth: 1, borderColor: appColors.border, borderRadius: 15, backgroundColor: appColors.surface, padding: 15 },
  selectedUserCard: { borderColor: appColors.primary, borderWidth: 2 },
  userName: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  userMeta: { marginTop: 6, color: appColors.muted, fontSize: 12 },
  status: { alignSelf: 'flex-start', marginTop: 9, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  activeStatus: { backgroundColor: '#E6F5ED', color: '#236443' },
  inactiveStatus: { backgroundColor: '#FCE9E8', color: '#9F3732' },
  openHint: { marginTop: 10, color: appColors.primary, fontSize: 12, fontWeight: '700' },
  detailCard: { marginTop: 24, borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface, padding: 18 },
  detailLine: { marginTop: 9, color: appColors.ink, fontSize: 13, lineHeight: 19 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 9, marginTop: 17 },
  deleteButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8B1AE', borderRadius: 11, backgroundColor: appColors.surface, paddingHorizontal: 13 },
  deleteButtonText: { color: '#A53D38', fontSize: 13, fontWeight: '700' },
  errorCard: { marginTop: 8, padding: 17, borderRadius: 15, backgroundColor: '#FCE9E8' },
  errorTitle: { color: '#9F3732', fontSize: 15, fontWeight: '800' },
  errorBody: { marginTop: 8, color: '#713B39', fontSize: 13, lineHeight: 20 },
  retryButton: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: appColors.surface },
  retryText: { color: appColors.primary, fontSize: 13, fontWeight: '800' },
  emptyCard: { marginTop: 5, padding: 18, borderRadius: 16, backgroundColor: appColors.surface },
  confirmCard: { marginTop: 18, borderWidth: 1, borderColor: '#E8B1AE', borderRadius: 18, backgroundColor: appColors.surface, padding: 18 },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 },
  pageButton: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 10, backgroundColor: appColors.surface, paddingHorizontal: 13 },
  pageText: { color: appColors.muted, fontSize: 13, fontWeight: '600' },
});
