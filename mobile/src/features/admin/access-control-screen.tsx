import { useEffect, useMemo, useState } from 'react';
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

import {
  accessControlApi,
  type AccessPermission,
  type AccessRole,
  type ApiMethod,
  type CatalogEndpoint,
  type EndpointWrite,
  type PermissionEndpointMapping,
  type PermissionWrite,
  type RolePermissionMapping,
  type RoleWrite,
} from './access-control-api';
import { typography } from '@/constants/typography';

type Catalog =
  | 'roles'
  | 'permissions'
  | 'endpoints'
  | 'role-permissions'
  | 'permission-endpoints';
type CatalogItem = AccessRole | AccessPermission | CatalogEndpoint;
type MappingDeleteTarget =
  | { kind: 'role-permission'; mapping: RolePermissionMapping }
  | { kind: 'permission-endpoint'; mapping: PermissionEndpointMapping };
type Draft = {
  name: string;
  description: string;
  parentRoleId: string;
  method: ApiMethod;
  path: string;
  isPublic: boolean;
};

const METHODS: ApiMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PAGE_SIZE = 20;

function emptyDraft(): Draft {
  return {
    name: '',
    description: '',
    parentRoleId: '',
    method: 'GET',
    path: '',
    isPublic: false,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const status = error.status === null ? '' : ` · HTTP ${error.status}`;
    const code = error.apiCode ? ` · API ${error.apiCode}` : '';
    return `${error.operation}: ${error.message}${status}${code}`;
  }
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu.';
}

function isEndpoint(item: CatalogItem): item is CatalogEndpoint {
  return 'method' in item && 'path' in item;
}

export function AccessControlScreen({ session }: { session: Session }) {
  const [catalog, setCatalog] = useState<Catalog>('roles');
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [endpoints, setEndpoints] = useState<CatalogEndpoint[]>([]);
  const [roleMappings, setRoleMappings] = useState<RolePermissionMapping[]>([]);
  const [permissionMappings, setPermissionMappings] = useState<PermissionEndpointMapping[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionId, setSelectedPermissionId] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState<'ALL' | ApiMethod>('ALL');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null);
  const [mappingDeleteTarget, setMappingDeleteTarget] = useState<MappingDeleteTarget | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (catalog === 'roles') {
          const result = await accessControlApi.listRoles(session);
          if (active) setRoles(result);
        } else if (catalog === 'permissions') {
          const result = await accessControlApi.listPermissions(session);
          if (active) setPermissions(result);
        } else if (catalog === 'endpoints' || catalog === 'permission-endpoints') {
          const result = await accessControlApi.listEndpoints(session, {
            page,
            limit: PAGE_SIZE,
            method:
              catalog === 'endpoints' && methodFilter !== 'ALL'
                ? methodFilter
                : undefined,
          });
          if (active) {
            setEndpoints(result.data);
            setTotal(result.total);
            setPage(result.page);
          }
        }

        if (catalog === 'role-permissions') {
          const [roleRows, permissionRows] = await Promise.all([
            accessControlApi.listRoles(session),
            accessControlApi.listPermissions(session),
          ]);
          if (!active) return;
          setRoles(roleRows);
          setPermissions(permissionRows);

          if (selectedRoleId === null || !roleRows.some((role) => role.id === selectedRoleId)) {
            if (selectedRoleId !== null) setSelectedRoleId(null);
            setRoleMappings([]);
            return;
          }
          const mappings = await accessControlApi.listRolePermissions(session, selectedRoleId);
          if (active) setRoleMappings(mappings);
        } else if (catalog === 'permission-endpoints') {
          const permissionRows = await accessControlApi.listPermissions(session);
          if (!active) return;
          setPermissions(permissionRows);

          if (
            selectedPermissionId === null ||
            !permissionRows.some((permission) => permission.id === selectedPermissionId)
          ) {
            if (selectedPermissionId !== null) setSelectedPermissionId(null);
            setPermissionMappings([]);
            return;
          }
          const mappings = await accessControlApi.listPermissionEndpoints(session, selectedPermissionId);
          if (active) setPermissionMappings(mappings);
        }
      } catch (error) {
        if (active) setLoadError(errorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [catalog, methodFilter, page, reloadKey, selectedPermissionId, selectedRoleId, session]);

  const items = useMemo<CatalogItem[]>(() => {
    if (catalog === 'roles') return roles;
    if (catalog === 'permissions') return permissions;
    return catalog === 'endpoints' ? endpoints : [];
  }, [catalog, endpoints, permissions, roles]);

  const isCatalogView =
    catalog === 'roles' || catalog === 'permissions' || catalog === 'endpoints';

  function changeCatalog(next: Catalog) {
    if (next === catalog) {
      setLoading(true);
      setLoadError(null);
      setReloadKey((value) => value + 1);
      return;
    }
    setCatalog(next);
    setLoading(true);
    setLoadError(null);
    setPage(1);
    setFormOpen(false);
    setEditingId(null);
    setDeleteTarget(null);
    setMappingDeleteTarget(null);
    setActionError(null);
    setNotice(null);
  }

  function manageRolePermissions(role: AccessRole) {
    setSelectedRoleId(role.id);
    setRoleMappings([]);
    changeCatalog('role-permissions');
  }

  function selectRole(roleId: number) {
    setSelectedRoleId(roleId);
    setRoleMappings([]);
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setMappingDeleteTarget(null);
  }

  function managePermissionEndpoints(permission: AccessPermission) {
    setSelectedPermissionId(permission.id);
    setPermissionMappings([]);
    changeCatalog('permission-endpoints');
  }

  function selectPermission(permissionId: number) {
    setSelectedPermissionId(permissionId);
    setPermissionMappings([]);
    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setMappingDeleteTarget(null);
  }
  function startCreate() {
    setDraft(emptyDraft());
    setEditingId(null);
    setFormOpen(true);
    setActionError(null);
    setNotice(null);
    setDeleteTarget(null);
  }

  function startEdit(item: CatalogItem) {
    setDraft({
      name: item.name,
      description: item.description ?? '',
      parentRoleId:
        'parent_role_id' in item && item.parent_role_id != null
          ? String(item.parent_role_id)
          : '',
      method: isEndpoint(item) ? item.method : 'GET',
      path: isEndpoint(item) ? item.path : '',
      isPublic: isEndpoint(item) && item.is_public === 1,
    });
    setEditingId(item.id);
    setFormOpen(true);
    setActionError(null);
    setNotice(null);
    setDeleteTarget(null);
  }

  function cancelForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyDraft());
    setActionError(null);
  }

  async function submitForm() {
    const name = draft.name.trim();
    if (!name) {
      setActionError('Nhập tên theo hợp đồng API trước khi lưu.');
      return;
    }

    let roleInput: RoleWrite | undefined;
    let permissionInput: PermissionWrite | undefined;
    let endpointInput: EndpointWrite | undefined;

    if (catalog === 'roles') {
      let parentRoleId: number | null = null;
      if (draft.parentRoleId.trim()) {
        parentRoleId = Number(draft.parentRoleId);
        if (!Number.isInteger(parentRoleId)) {
          setActionError('Mã vai trò cha phải là số nguyên.');
          return;
        }
      }
      roleInput = {
        name,
        description: draft.description.trim(),
        parent_role_id: parentRoleId,
      };
    } else if (catalog === 'permissions') {
      permissionInput = { name, description: draft.description.trim() };
    } else {
      const path = draft.path.trim();
      if (!path) {
        setActionError('Nhập đường dẫn API trước khi lưu.');
        return;
      }
      endpointInput = {
        name,
        method: draft.method,
        path,
        description: draft.description.trim(),
        is_public: draft.isPublic ? 1 : 0,
      };
    }

    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      if (catalog === 'roles' && roleInput) {
        if (editingId === null) await accessControlApi.createRole(session, roleInput);
        else await accessControlApi.updateRole(session, editingId, roleInput);
      } else if (catalog === 'permissions' && permissionInput) {
        if (editingId === null) {
          await accessControlApi.createPermission(session, permissionInput);
        } else {
          await accessControlApi.updatePermission(session, editingId, permissionInput);
        }
      } else if (catalog === 'endpoints' && endpointInput) {
        if (editingId === null) {
          await accessControlApi.createEndpoint(session, endpointInput);
        } else {
          await accessControlApi.updateEndpoint(session, editingId, endpointInput);
        }
      }
      setNotice(editingId === null ? 'Máy chủ đã xác nhận tạo bản ghi.' : 'Máy chủ đã xác nhận cập nhật bản ghi.');
      setFormOpen(false);
      setEditingId(null);
      setDraft(emptyDraft());
      setLoading(true);
      setLoadError(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      if (catalog === 'roles') await accessControlApi.deleteRole(session, deleteTarget.id);
      else if (catalog === 'permissions') {
        await accessControlApi.deletePermission(session, deleteTarget.id);
      } else {
        await accessControlApi.deleteEndpoint(session, deleteTarget.id);
      }
      setNotice('Máy chủ đã xác nhận xoá bản ghi.');
      setDeleteTarget(null);
      setLoading(true);
      setLoadError(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function assignRolePermission(permissionId: number) {
    if (selectedRoleId === null) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await accessControlApi.assignRolePermission(session, selectedRoleId, permissionId);
      setNotice('Máy chủ đã xác nhận gán quyền. Đang tải lại các quyền của vai trò.');
      setLoading(true);
      setLoadError(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function assignPermissionEndpoint(endpointId: number) {
    if (selectedPermissionId === null) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await accessControlApi.assignPermissionEndpoint(session, selectedPermissionId, endpointId);
      setNotice('Máy chủ đã xác nhận gán API. Đang tải lại các API của quyền.');
      setLoading(true);
      setLoadError(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function confirmRevokeMapping() {
    if (!mappingDeleteTarget) return;
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      if (mappingDeleteTarget.kind === 'role-permission' && selectedRoleId !== null) {
        await accessControlApi.revokeRolePermission(
          session,
          selectedRoleId,
          mappingDeleteTarget.mapping.permission_id,
        );
        setNotice('Máy chủ đã xác nhận thu hồi quyền khỏi vai trò.');
      } else if (
        mappingDeleteTarget.kind === 'permission-endpoint' &&
        selectedPermissionId !== null
      ) {
        await accessControlApi.revokePermissionEndpoint(
          session,
          selectedPermissionId,
          mappingDeleteTarget.mapping.endpoint_id,
        );
        setNotice('Máy chủ đã xác nhận thu hồi API khỏi quyền.');
      } else {
        return;
      }
      setMappingDeleteTarget(null);
      setLoading(true);
      setLoadError(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;
  const selectedPermission =
    permissions.find((permission) => permission.id === selectedPermissionId) ?? null;
  const availablePermissions = permissions.filter(
    (permission) => !roleMappings.some((mapping) => mapping.permission_id === permission.id),
  );
  const availableEndpoints = endpoints.filter(
    (endpoint) => !permissionMappings.some((mapping) => mapping.endpoint_id === endpoint.id),
  );
  const title =
    catalog === 'roles'
      ? 'Vai trò'
      : catalog === 'permissions'
        ? 'Quyền'
        : catalog === 'endpoints'
          ? 'Danh mục API'
          : catalog === 'role-permissions'
            ? 'Vai trò và quyền'
            : 'Quyền và API';
  const subtitle =
    catalog === 'roles'
      ? 'Danh sách vai trò được trả về từ máy chủ.'
      : catalog === 'permissions'
        ? 'Danh sách quyền nghiệp vụ được trả về từ máy chủ.'
        : catalog === 'endpoints'
          ? 'API endpoint là dữ liệu danh mục của backend, không phải tuyến điều hướng của ứng dụng.'
          : catalog === 'role-permissions'
            ? 'Xem, gán và thu hồi quyền của một vai trò từ dữ liệu máy chủ.'
            : 'Xem, gán và thu hồi API được gắn với một quyền từ dữ liệu máy chủ.';

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MAY DAY / QUẢN TRỊ</Text>
        <Text style={styles.title}>Danh mục phân quyền</Text>
        <Text style={styles.subtitle}>
          Thay đổi tại đây không tự cấp quyền API cho tài khoản hoặc thay đổi điều hướng phía ứng dụng.
          Quyền truy cập thực tế luôn do backend xác nhận.
        </Text>

        <ScrollView
          accessibilityRole="tablist"
          contentContainerStyle={styles.tabs}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {([
            ['roles', 'Vai trò'],
            ['permissions', 'Quyền'],
            ['endpoints', 'API'],
            ['role-permissions', 'Vai trò–quyền'],
            ['permission-endpoints', 'Quyền–API'],
          ] as const).map(([value, label]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: catalog === value }}
              key={value}
              onPress={() => changeCatalog(value)}
              style={[styles.tab, catalog === value && styles.activeTab]}>
              <Text style={[styles.tabText, catalog === value && styles.activeTabText]}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <View style={styles.headingBlock}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <Text style={styles.sectionSubtitle}>{subtitle}</Text>
          </View>
          {isCatalogView ? (
            <Pressable
              accessibilityRole="button"
              onPress={startCreate}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>＋ Thêm mới</Text>
            </Pressable>
          ) : null}
        </View>

        {catalog === 'endpoints' ? (
          <View style={styles.filterBlock}>
            <Text style={styles.fieldLabel}>Lọc theo HTTP method</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(['ALL', ...METHODS] as const).map((value) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: methodFilter === value }}
                  key={value}
                  onPress={() => {
                    if (methodFilter === value && page === 1) {
                      setLoading(true);
                      setLoadError(null);
                      setReloadKey((current) => current + 1);
                      return;
                    }
                    setLoading(true);
                    setLoadError(null);
                    setMethodFilter(value);
                    setPage(1);
                  }}
                  style={[styles.filterChip, methodFilter === value && styles.selectedChip]}>
                  <Text style={[styles.filterText, methodFilter === value && styles.selectedChipText]}>
                    {value === 'ALL' ? 'Tất cả' : value}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {catalog === 'role-permissions' ? (
          <View style={styles.mappingSection}>
            <Text style={styles.mappingHeading}>Chọn vai trò từ danh mục máy chủ</Text>
            <View style={styles.mappingOptions}>
              {roles.map((role) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedRoleId === role.id }}
                  disabled={saving}
                  key={role.id}
                  onPress={() => selectRole(role.id)}
                  style={[styles.mappingOption, selectedRoleId === role.id && styles.selectedChip]}>
                  <Text style={[styles.filterText, selectedRoleId === role.id && styles.selectedChipText]}>
                    {role.name} · ID {role.id}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!loading && !loadError && roles.length === 0 ? (
              <Text style={styles.itemDescription}>Máy chủ chưa trả về vai trò nào để quản lý.</Text>
            ) : null}
          </View>
        ) : null}

        {catalog === 'permission-endpoints' ? (
          <View style={styles.mappingSection}>
            <Text style={styles.mappingHeading}>Chọn quyền từ danh mục máy chủ</Text>
            <View style={styles.mappingOptions}>
              {permissions.map((permission) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedPermissionId === permission.id }}
                  disabled={saving}
                  key={permission.id}
                  onPress={() => selectPermission(permission.id)}
                  style={[styles.mappingOption, selectedPermissionId === permission.id && styles.selectedChip]}>
                  <Text style={[styles.filterText, selectedPermissionId === permission.id && styles.selectedChipText]}>
                    {permission.name} · ID {permission.id}
                  </Text>
                </Pressable>
              ))}
            </View>
            {!loading && !loadError && permissions.length === 0 ? (
              <Text style={styles.itemDescription}>Máy chủ chưa trả về quyền nào để quản lý.</Text>
            ) : null}
          </View>
        ) : null}

        {notice ? <Text style={styles.successMessage}>{notice}</Text> : null}
        {actionError ? <Text accessibilityRole="alert" style={styles.errorMessage}>{actionError}</Text> : null}

        {formOpen ? (
          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>{editingId === null ? `Tạo ${title.toLowerCase()}` : `Cập nhật ${title.toLowerCase()}`}</Text>
            <Field label="Tên" value={draft.name} onChange={(name) => setDraft((current) => ({ ...current, name }))} />
            {catalog === 'roles' ? (
              <Field
                label="Mã vai trò cha (tuỳ chọn)"
                keyboardType="numeric"
                value={draft.parentRoleId}
                onChange={(parentRoleId) => setDraft((current) => ({ ...current, parentRoleId }))}
              />
            ) : null}
            {catalog === 'endpoints' ? (
              <>
                <Text style={styles.fieldLabel}>HTTP method</Text>
                <View style={styles.methodRow}>
                  {METHODS.map((method) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: draft.method === method }}
                      key={method}
                      onPress={() => setDraft((current) => ({ ...current, method }))}
                      style={[styles.methodButton, draft.method === method && styles.selectedChip]}>
                      <Text style={[styles.filterText, draft.method === method && styles.selectedChipText]}>{method}</Text>
                    </Pressable>
                  ))}
                </View>
                <Field label="Đường dẫn API" value={draft.path} onChange={(path) => setDraft((current) => ({ ...current, path }))} autoCapitalize="none" />
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: draft.isPublic }}
                  onPress={() => setDraft((current) => ({ ...current, isPublic: !current.isPublic }))}
                  style={styles.checkboxRow}>
                  <View style={[styles.checkbox, draft.isPublic && styles.checkboxChecked]}>
                    {draft.isPublic ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>API công khai (bỏ qua kiểm tra quyền)</Text>
                </Pressable>
              </>
            ) : null}
            <Field
              label="Mô tả (tuỳ chọn)"
              value={draft.description}
              onChange={(description) => setDraft((current) => ({ ...current, description }))}
              multiline
            />
            <View style={styles.formActions}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={cancelForm} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Huỷ</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void submitForm()}
                style={[styles.primaryButton, saving && styles.disabledButton]}>
                {saving ? <ActivityIndicator color={appColors.surface} /> : <Text style={styles.primaryButtonText}>Lưu</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        {deleteTarget ? (
          <View style={styles.confirmCard}>
            <Text style={styles.cardTitle}>Xác nhận xoá</Text>
            <Text style={styles.itemDescription}>
              Xoá “{deleteTarget.name}”? Bản ghi chỉ biến mất khỏi danh sách sau khi máy chủ xác nhận.
            </Text>
            <View style={styles.formActions}>
              <Pressable accessibilityRole="button" disabled={saving} onPress={() => setDeleteTarget(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Huỷ</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void confirmDelete()}
                style={[styles.dangerButton, saving && styles.disabledButton]}>
                {saving ? <ActivityIndicator color={appColors.surface} /> : <Text style={styles.primaryButtonText}>Xoá</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        {mappingDeleteTarget ? (
          <View style={styles.confirmCard}>
            <Text style={styles.cardTitle}>Xác nhận thu hồi liên kết</Text>
            <Text style={styles.itemDescription}>
              {mappingDeleteTarget.kind === 'role-permission'
                ? `Thu hồi quyền “${mappingDeleteTarget.mapping.name}” khỏi vai trò “${selectedRole?.name ?? selectedRoleId}”?`
                : `Thu hồi API “${mappingDeleteTarget.mapping.method} ${mappingDeleteTarget.mapping.path}” khỏi quyền “${selectedPermission?.name ?? selectedPermissionId}”?`}
              {' '}Liên kết chỉ được cập nhật sau khi máy chủ xác nhận.
            </Text>
            <View style={styles.formActions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => setMappingDeleteTarget(null)}
                style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Huỷ</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={() => void confirmRevokeMapping()}
                style={[styles.dangerButton, saving && styles.disabledButton]}>
                {saving ? <ActivityIndicator color={appColors.surface} /> : <Text style={styles.primaryButtonText}>Thu hồi</Text>}
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <Text style={styles.listHeading}>{isCatalogView ? `${title} trên máy chủ` : 'Liên kết trên máy chủ'}</Text>
          <Pressable accessibilityRole="button" onPress={() => {
            setLoading(true);
            setLoadError(null);
            setReloadKey((value) => value + 1);
          }} style={styles.refreshButton}>
            <Text style={styles.refreshText}>Làm mới</Text>
          </Pressable>
        </View>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={appColors.primary} />
            <Text style={styles.loadingText}>Đang tải dữ liệu từ máy chủ…</Text>
          </View>
        ) : null}
        {!loading && loadError ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorTitle}>Không tải được dữ liệu</Text>
            <Text style={styles.errorBody}>{loadError}</Text>
            <Text style={styles.errorBody}>Không có dữ liệu giả được hiển thị. Hãy thử lại khi dịch vụ sẵn sàng.</Text>
            <Pressable accessibilityRole="button" onPress={() => {
              setLoading(true);
              setLoadError(null);
              setReloadKey((value) => value + 1);
            }} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}
        {isCatalogView && !loading && !loadError && items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.cardTitle}>Chưa có bản ghi</Text>
            <Text style={styles.itemDescription}>Máy chủ đã trả về danh sách rỗng cho danh mục này.</Text>
          </View>
        ) : null}
        {isCatalogView && !loading && !loadError ? (
          <View style={styles.list}>
            {items.map((item) => (
              <CatalogCard
                catalog={catalog}
                item={item}
                key={`${catalog}-${item.id}`}
                onManage={
                  catalog === 'roles'
                    ? () => manageRolePermissions(item as AccessRole)
                    : catalog === 'permissions'
                      ? () => managePermissionEndpoints(item as AccessPermission)
                      : undefined
                }
                onEdit={() => startEdit(item)}
                onDelete={() => {
                  setDeleteTarget(item);
                  setFormOpen(false);
                  setActionError(null);
                }}
              />
            ))}
          </View>
        ) : null}
        {catalog === 'role-permissions' && !loading && !loadError ? (
          <View style={styles.mappingSection}>
            {selectedRole ? (
              <>
                <Text style={styles.mappingHeading}>Quyền đã gán cho {selectedRole.name}</Text>
                {roleMappings.length === 0 ? (
                  <Text style={styles.itemDescription}>Máy chủ đã trả về danh sách quyền rỗng cho vai trò này.</Text>
                ) : (
                  <View style={styles.mappingList}>
                    {roleMappings.map((mapping) => (
                      <View key={mapping.permission_id} style={styles.mappingCard}>
                        <View style={styles.mappingCopy}>
                          <Text style={styles.itemName}>{mapping.name}</Text>
                          <Text style={styles.itemMeta}>Permission ID: {mapping.permission_id}</Text>
                          {mapping.description ? <Text style={styles.itemDescription}>{mapping.description}</Text> : null}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          disabled={saving}
                          onPress={() => setMappingDeleteTarget({ kind: 'role-permission', mapping })}
                          style={styles.deleteButton}>
                          <Text style={styles.deleteButtonText}>Thu hồi</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.mappingHeading}>Gán quyền từ danh mục máy chủ</Text>
                {availablePermissions.length === 0 ? (
                  <Text style={styles.itemDescription}>Không còn quyền chưa gán trong danh mục trả về.</Text>
                ) : (
                  <View style={styles.mappingList}>
                    {availablePermissions.map((permission) => (
                      <View key={permission.id} style={styles.mappingCard}>
                        <View style={styles.mappingCopy}>
                          <Text style={styles.itemName}>{permission.name}</Text>
                          <Text style={styles.itemMeta}>Permission ID: {permission.id}</Text>
                          {permission.description ? <Text style={styles.itemDescription}>{permission.description}</Text> : null}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          disabled={saving}
                          onPress={() => void assignRolePermission(permission.id)}
                          style={[styles.primaryButton, saving && styles.disabledButton]}>
                          <Text style={styles.primaryButtonText}>＋ Gán</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.itemDescription}>Chọn vai trò ở trên để tải các liên kết đã lưu và quản lý quyền.</Text>
            )}
          </View>
        ) : null}
        {catalog === 'permission-endpoints' && !loading && !loadError ? (
          <View style={styles.mappingSection}>
            {selectedPermission ? (
              <>
                <Text style={styles.mappingHeading}>API đã gán cho quyền {selectedPermission.name}</Text>
                {permissionMappings.length === 0 ? (
                  <Text style={styles.itemDescription}>Máy chủ đã trả về danh sách API rỗng cho quyền này.</Text>
                ) : (
                  <View style={styles.mappingList}>
                    {permissionMappings.map((mapping) => (
                      <View key={mapping.endpoint_id} style={styles.mappingCard}>
                        <View style={styles.mappingCopy}>
                          <Text style={styles.itemName}>{mapping.name}</Text>
                          <Text style={styles.endpointPath}>{mapping.method} · {mapping.path}</Text>
                          <Text style={styles.itemMeta}>Endpoint ID: {mapping.endpoint_id}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          disabled={saving}
                          onPress={() => setMappingDeleteTarget({ kind: 'permission-endpoint', mapping })}
                          style={styles.deleteButton}>
                          <Text style={styles.deleteButtonText}>Thu hồi</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.mappingHeading}>Gán API từ danh mục máy chủ · Trang {page}</Text>
                {availableEndpoints.length === 0 ? (
                  <Text style={styles.itemDescription}>
                    Không còn API chưa gán trên trang này. Dùng điều hướng trang bên dưới để xem các API khác.
                  </Text>
                ) : (
                  <View style={styles.mappingList}>
                    {availableEndpoints.map((endpoint) => (
                      <View key={endpoint.id} style={styles.mappingCard}>
                        <View style={styles.mappingCopy}>
                          <Text style={styles.itemName}>{endpoint.name}</Text>
                          <Text style={styles.endpointPath}>{endpoint.method} · {endpoint.path}</Text>
                          <Text style={styles.itemMeta}>Endpoint ID: {endpoint.id}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          disabled={saving}
                          onPress={() => void assignPermissionEndpoint(endpoint.id)}
                          style={[styles.primaryButton, saving && styles.disabledButton]}>
                          <Text style={styles.primaryButtonText}>＋ Gán</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.itemDescription}>Chọn quyền ở trên để tải các liên kết đã lưu và quản lý API.</Text>
            )}
          </View>
        ) : null}
        {(catalog === 'endpoints' || catalog === 'permission-endpoints') &&
        !loading &&
        !loadError &&
        total > PAGE_SIZE ? (
          <View style={styles.pagination}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: page <= 1 }}
              disabled={page <= 1}
              onPress={() => {
                setLoadError(null);
                setLoading(true);
                setPage((value) => Math.max(1, value - 1));
              }}
              style={[styles.secondaryButton, page <= 1 && styles.disabledButton]}>
              <Text style={styles.secondaryButtonText}>Trước</Text>
            </Pressable>
            <Text style={styles.pageText}>Trang {page} / {pageCount} · {total} API</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: page >= pageCount }}
              disabled={page >= pageCount}
              onPress={() => {
                setLoadError(null);
                setLoading(true);
                setPage((value) => Math.min(pageCount, value + 1));
              }}
              style={[styles.secondaryButton, page >= pageCount && styles.disabledButton]}>
              <Text style={styles.secondaryButtonText}>Tiếp</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChange}
        placeholder={label}
        placeholderTextColor={appColors.muted}
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

function CatalogCard({
  catalog,
  item,
  onManage,
  onEdit,
  onDelete,
}: {
  catalog: Catalog;
  item: CatalogItem;
  onManage?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const endpoint = isEndpoint(item) ? item : null;
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        {endpoint ? (
          <View style={styles.methodBadge}>
            <Text style={styles.methodBadgeText}>{endpoint.method}</Text>
          </View>
        ) : null}
        <Text style={styles.itemName}>{item.name}</Text>
      </View>
      {endpoint ? <Text selectable style={styles.endpointPath}>{endpoint.path}</Text> : null}
      {catalog === 'roles' && 'parent_role_id' in item && item.parent_role_id != null ? (
        <Text style={styles.itemMeta}>Vai trò cha ID: {item.parent_role_id}</Text>
      ) : null}
      {endpoint ? <Text style={styles.itemMeta}>{endpoint.is_public === 1 ? 'API công khai' : 'API yêu cầu quyền'}</Text> : null}
      {item.description ? <Text style={styles.itemDescription}>{item.description}</Text> : null}
      <View style={styles.cardActions}>
        {onManage ? (
          <Pressable accessibilityRole="button" onPress={onManage} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{catalog === 'roles' ? 'Quyền' : 'API'}</Text>
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sửa</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onDelete} style={styles.deleteButton}>
          <Text style={styles.deleteButtonText}>Xoá</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 44 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, fontFamily: typography.medium },
  title: { marginTop: 12, color: appColors.ink, fontSize: 30, fontWeight: '800', fontFamily: typography.medium },
  subtitle: { marginTop: 9, color: appColors.muted, fontSize: 14, lineHeight: 21, fontFamily: typography.regular },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 23, padding: 5, borderRadius: 16, backgroundColor: '#E4EDF5' },
  tab: { minWidth: 88, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 10 },
  activeTab: { backgroundColor: appColors.surface, shadowColor: '#16334D', shadowOpacity: 0.08, shadowRadius: 5, elevation: 1 },
  tabText: { color: appColors.muted, fontSize: 14, fontWeight: '700', fontFamily: typography.medium },
  activeTabText: { color: appColors.primary, fontWeight: '800', fontFamily: typography.medium },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 25 },
  headingBlock: { flex: 1, minWidth: 190 },
  sectionTitle: { color: appColors.ink, fontSize: 21, fontWeight: '800', fontFamily: typography.medium },
  sectionSubtitle: { marginTop: 5, color: appColors.muted, fontSize: 13, lineHeight: 19, fontFamily: typography.regular },
  primaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: appColors.primary, paddingHorizontal: 16 },
  primaryButtonText: { color: appColors.surface, fontSize: 14, fontWeight: '800', fontFamily: typography.medium },
  pressed: { opacity: 0.78 },
  filterBlock: { marginTop: 19 },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  mappingSection: { marginTop: 18, borderWidth: 1, borderColor: appColors.border, borderRadius: 16, backgroundColor: appColors.surface, padding: 16, gap: 11 },
  mappingHeading: { marginTop: 4, color: appColors.ink, fontSize: 15, fontWeight: '800', fontFamily: typography.medium },
  mappingOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mappingOption: { minHeight: 38, justifyContent: 'center', borderRadius: 999, backgroundColor: '#EAF0F5', paddingHorizontal: 13 },
  mappingList: { gap: 9 },
  mappingCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, padding: 12 },
  mappingCopy: { flex: 1, minWidth: 180 },
  filterChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 999, backgroundColor: appColors.surface },
  selectedChip: { backgroundColor: appColors.primary },
  filterText: { color: appColors.ink, fontSize: 12, fontWeight: '700', fontFamily: typography.medium },
  selectedChipText: { color: appColors.surface },
  fieldLabel: { marginBottom: 7, color: appColors.ink, fontSize: 13, fontWeight: '700', fontFamily: typography.medium },
  successMessage: { marginTop: 15, padding: 13, borderRadius: 12, backgroundColor: '#E6F5ED', color: '#236443', fontSize: 13, lineHeight: 19 },
  errorMessage: { marginTop: 15, padding: 13, borderRadius: 12, backgroundColor: '#FCE9E8', color: '#9F3732', fontSize: 13, lineHeight: 19 },
  formCard: { marginTop: 18, borderWidth: 1, borderColor: appColors.border, borderRadius: 18, backgroundColor: appColors.surface, padding: 18, gap: 14 },
  confirmCard: { marginTop: 18, borderWidth: 1, borderColor: '#E8B1AE', borderRadius: 18, backgroundColor: appColors.surface, padding: 18 },
  cardTitle: { color: appColors.ink, fontSize: 17, fontWeight: '800', fontFamily: typography.medium },
  field: { width: '100%' },
  input: { minHeight: 46, borderWidth: 1, borderColor: appColors.border, borderRadius: 11, backgroundColor: '#FBFDFF', paddingHorizontal: 12, paddingVertical: 10, color: appColors.ink, fontSize: 14 },
  multilineInput: { minHeight: 82, textAlignVertical: 'top' },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#EAF0F5' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42 },
  checkbox: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 5 },
  checkboxChecked: { borderColor: appColors.primary, backgroundColor: appColors.primary },
  checkmark: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  checkboxLabel: { flex: 1, color: appColors.ink, fontSize: 13 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 5 },
  secondaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 10, paddingHorizontal: 13 },
  secondaryButtonText: { color: appColors.ink, fontSize: 13, fontWeight: '700' },
  dangerButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#B7433D', paddingHorizontal: 15 },
  disabledButton: { opacity: 0.5 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 11 },
  listHeading: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  refreshButton: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 10 },
  refreshText: { color: appColors.primary, fontSize: 13, fontWeight: '700' },
  loadingRow: { minHeight: 90, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  loadingText: { color: appColors.muted, fontSize: 13 },
  errorCard: { marginTop: 5, padding: 18, borderRadius: 16, backgroundColor: '#FCE9E8' },
  errorTitle: { color: '#9F3732', fontSize: 16, fontWeight: '800' },
  errorBody: { marginTop: 8, color: '#713B39', fontSize: 13, lineHeight: 20 },
  retryButton: { alignSelf: 'flex-start', marginTop: 14, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: appColors.surface },
  retryText: { color: appColors.primary, fontSize: 13, fontWeight: '800' },
  emptyCard: { marginTop: 5, padding: 18, borderRadius: 16, backgroundColor: appColors.surface },
  itemDescription: { marginTop: 7, color: appColors.muted, fontSize: 13, lineHeight: 19 },
  list: { gap: 11 },
  itemCard: { borderWidth: 1, borderColor: appColors.border, borderRadius: 16, backgroundColor: appColors.surface, padding: 16 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemName: { flex: 1, color: appColors.ink, fontSize: 15, fontWeight: '800' },
  methodBadge: { minWidth: 52, alignItems: 'center', borderRadius: 7, backgroundColor: '#E7F1FA', paddingHorizontal: 8, paddingVertical: 5 },
  methodBadgeText: { color: appColors.primary, fontSize: 11, fontWeight: '800' },
  endpointPath: { marginTop: 9, color: appColors.primary, fontSize: 13, fontWeight: '700' },
  itemMeta: { marginTop: 7, color: appColors.muted, fontSize: 12 },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 14 },
  deleteButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E8B1AE', borderRadius: 10, paddingHorizontal: 13 },
  deleteButtonText: { color: '#A53D38', fontSize: 13, fontWeight: '700' },
  pagination: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18 },
  pageText: { color: appColors.muted, fontSize: 13, fontWeight: '600' },
});
