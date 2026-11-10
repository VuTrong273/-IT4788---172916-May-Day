import { useCallback, useEffect, useState } from 'react';
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

import { appColors } from '@/constants/app-theme';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { getDemoRole } from '@/features/navigation/feature-routes';

import {
  templatesApi,
  type TemplateDetail,
  type TemplateSummary,
} from './templates-api';
import { TemplateAuthoring } from './template-authoring';
import {
  validateTemplateDraft,
  type TemplateDraft,
} from './template-form';
import { fontSizes, typography } from '@/constants/typography';

const PAGE_SIZE = 20;
type ActiveFilter = 'all' | '1' | '0';

const emptyDraft: TemplateDraft = {
  code_template: '',
  name: '',
  description: '',
  version: '',
  is_active: '1',
};

function draftFromTemplate(template: TemplateSummary): TemplateDraft {
  return {
    code_template: template.code_template,
    name: template.name,
    description: template.description ?? '',
    version: template.version ?? '',
    is_active: template.is_active,
  };
}

function userMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Không thể hoàn tất yêu cầu. Hãy thử lại.';
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  editable = true,
  autoCapitalize = 'sentences',
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        editable={editable}
        maxLength={label === 'Mã mẫu phiếu' ? 225 : undefined}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appColors.muted}
        style={[styles.input, multiline && styles.multiline, !editable && styles.readOnlyInput]}
        value={value}
      />
    </View>
  );
}

export function TemplateCatalogScreen() {
  const session = useAuthenticatedSession();
  const role = session ? getDemoRole(session.user.role_id) : null;
  const isAdmin = role === 'admin';
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<ActiveFilter>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<TemplateDetail | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [authoringDirty, setAuthoringDirty] = useState(false);
  const [confirmLeaveAuthoring, setConfirmLeaveAuthoring] = useState(false);

  const handleAuthoringDirtyChange = useCallback((dirty: boolean) => {
    setAuthoringDirty(dirty);
  }, []);

  const loadTemplates = useCallback(async (requestedPage: number, requestedFilter: ActiveFilter) => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const response = await templatesApi.list(session, {
        page: requestedPage,
        limit: PAGE_SIZE,
        ...(requestedFilter === 'all' ? {} : { is_active: requestedFilter }),
      });
      setTemplates(response.data);
      setPage(response.page);
      setTotal(response.total);
    } catch (requestError) {
      setError(userMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const loadDetail = useCallback(async (code: string) => {
    if (!session) return;
    setSelectedCode(code);
    setSelected(null);
    setDetailLoading(true);
    setDetailError('');
    setNotice('');
    setCreating(false);
    setEditing(false);
    setConfirmDelete(false);
    setAuthoringDirty(false);
    setConfirmLeaveAuthoring(false);
    try {
      const response = await templatesApi.get(session, code);
      setSelected(response);
    } catch (requestError) {
      setDetailError(userMessage(requestError));
    } finally {
      setDetailLoading(false);
    }
  }, [session]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTemplates(1, 'all');
    }, 0);
    return () => clearTimeout(timer);
  }, [loadTemplates]);

  if (!session || !role || !['admin', 'doctor', 'patient'].includes(role)) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.content}>
          <Text accessibilityRole="alert" style={styles.error}>
            Không thể mở danh mục mẫu phiếu cho tài khoản này.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const openCreateForm = () => {
    setSelected(null);
    setSelectedCode(null);
    setCreating(true);
    setEditing(false);
    setConfirmDelete(false);
    setDraft(emptyDraft);
    setFormError('');
    setNotice('');
  };

  const cancelEditor = () => {
    setCreating(false);
    setEditing(false);
    setFormError('');
  };

  const beginEdit = () => {
    if (!selected || !isAdmin) return;
    setDraft(draftFromTemplate(selected));
    setEditing(true);
    setFormError('');
    setConfirmDelete(false);
  };

  const saveTemplate = async () => {
    if (!session) return;
    const mode = creating ? 'create' : 'edit';
    const validationMessage = validateTemplateDraft(draft, mode);
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setSaving(true);
    setFormError('');
    setNotice('');
    const commonFields = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      version: draft.version.trim(),
      ...(draft.is_active ? { is_active: draft.is_active } : {}),
    };

    try {
      if (creating) {
        const created = await templatesApi.create(session, {
          ...commonFields,
          code_template: draft.code_template.trim(),
        });
        setCreating(false);
        setDraft(emptyDraft);
        setFilter('all');
        setNotice(`Đã tạo mẫu phiếu “${created.name}” (${created.code_template}).`);
        await loadTemplates(1, 'all');
      } else if (selected) {
        const updated = await templatesApi.update(session, selected.code_template, {
          name: commonFields.name,
          description: commonFields.description,
          version: commonFields.version,
          is_active: commonFields.is_active,
        });
        setSelected({ ...selected, ...updated });
        setEditing(false);
        setNotice(`Đã cập nhật mẫu phiếu “${updated.name}”.`);
        await loadTemplates(page, filter);
      }
    } catch (requestError) {
      setFormError(userMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!session || !selected || !isAdmin) return;
    setDeleting(true);
    setFormError('');
    setNotice('');
    try {
      await templatesApi.remove(session, selected.code_template);
      const deletedName = selected.name;
      const nextPage = templates.length === 1 && page > 1 ? page - 1 : page;
      setSelected(null);
      setSelectedCode(null);
      setConfirmDelete(false);
      setNotice(`Đã xóa mẫu phiếu “${deletedName}”.`);
      setPage(nextPage);
      await loadTemplates(nextPage, filter);
    } catch (requestError) {
      setFormError(userMessage(requestError));
    } finally {
      setDeleting(false);
    }
  };

  const startPage = (nextPage: number) => {
    setSelected(null);
    setSelectedCode(null);
    setNotice('');
    void loadTemplates(nextPage, filter);
  };

  const selectFilter = (nextFilter: ActiveFilter) => {
    setFilter(nextFilter);
    setSelected(null);
    setSelectedCode(null);
    setNotice('');
    void loadTemplates(1, nextFilter);
  };

  const leaveTemplateDetail = () => {
    if (authoringDirty) {
      setConfirmLeaveAuthoring(true);
      return;
    }
    setSelected(null);
    setSelectedCode(null);
    setNotice('');
    setFormError('');
    setConfirmDelete(false);
  };

  const discardAndLeaveTemplateDetail = () => {
    setAuthoringDirty(false);
    setConfirmLeaveAuthoring(false);
    setSelected(null);
    setSelectedCode(null);
    setNotice('');
    setFormError('');
    setConfirmDelete(false);
  };

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const editorOpen = creating || editing;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>MAY DAY / MẪU PHIẾU</Text>
        <Text style={styles.title}>Danh mục mẫu phiếu</Text>
        <Text style={styles.subtitle}>
          {isAdmin
            ? 'Tra cứu và quản lý các mẫu phiếu được máy chủ trả về.'
            : 'Tra cứu mẫu phiếu và cấu trúc câu hỏi được cấp quyền.'}
        </Text>

        {notice ? <Text style={styles.success}>{notice}</Text> : null}
        {error ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            <ActionButton label="Thử tải lại" onPress={() => void loadTemplates(page, filter)} secondary />
          </View>
        ) : null}

        {selectedCode ? (
          <View style={styles.panel}>
            <ActionButton
              label="← Danh sách mẫu phiếu"
              onPress={leaveTemplateDetail}
              secondary
            />
            {detailLoading ? <ActivityIndicator accessibilityLabel="Đang tải mẫu phiếu" color={appColors.primary} style={styles.loading} /> : null}
            {detailError ? (
              <View style={styles.errorCard}>
                <Text accessibilityRole="alert" style={styles.error}>{detailError}</Text>
                <ActionButton label="Thử tải lại" onPress={() => void loadDetail(selectedCode)} secondary />
              </View>
            ) : null}
            {selected ? (
              <>
                <Text style={styles.sectionTitle}>{selected.name}</Text>
                <Text style={styles.code}>{selected.code_template}</Text>
                <View style={styles.metadata}>
                  <Text style={styles.metaText}>Phiên bản: {selected.version || 'Chưa có thông tin'}</Text>
                  <Text style={styles.metaText}>
                    Trạng thái: {selected.is_active === '0'
                      ? 'Không hoạt động'
                      : selected.is_active === '1' ? 'Hoạt động' : 'Máy chủ chưa cung cấp'}
                  </Text>
                  {selected.description ? <Text style={styles.metaText}>{selected.description}</Text> : null}
                </View>

                {isAdmin ? (
                  <View style={styles.actionRow}>
                    {!editorOpen ? <ActionButton label="Chỉnh sửa" onPress={beginEdit} /> : null}
                    {!editorOpen ? (
                      <ActionButton
                        label="Xóa mẫu phiếu"
                        onPress={() => {
                          setConfirmDelete(true);
                          setFormError('');
                          setNotice('');
                        }}
                        danger
                      />
                    ) : null}
                  </View>
                ) : null}

                {confirmDelete ? (
                  <View style={styles.confirmCard}>
                    <Text style={styles.confirmTitle}>Xác nhận xóa mẫu phiếu?</Text>
                    <Text style={styles.bodyText}>
                      Thao tác sẽ xóa cấu trúc mẫu này. Nếu mẫu đang được sử dụng, máy chủ có thể từ chối yêu cầu.
                    </Text>
                    <View style={styles.actionRow}>
                      <ActionButton label="Hủy" onPress={() => setConfirmDelete(false)} secondary disabled={deleting} />
                      <ActionButton label={deleting ? 'Đang xóa…' : 'Xác nhận xóa'} onPress={() => void deleteTemplate()} danger disabled={deleting} />
                    </View>
                  </View>
                ) : null}

                {formError && !editing ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
                {confirmLeaveAuthoring ? (
                  <View style={styles.confirmCard}>
                    <Text style={styles.confirmTitle}>Bỏ thay đổi phần hoặc câu hỏi?</Text>
                    <Text style={styles.bodyText}>
                      Thay đổi chưa gửi lên máy chủ sẽ bị mất.
                    </Text>
                    <View style={styles.actionRow}>
                      <ActionButton
                        label="Tiếp tục chỉnh sửa"
                        onPress={() => setConfirmLeaveAuthoring(false)}
                        secondary
                      />
                      <ActionButton
                        label="Bỏ thay đổi và rời"
                        onPress={discardAndLeaveTemplateDetail}
                        danger
                      />
                    </View>
                  </View>
                ) : null}
                {editing ? (
                  <TemplateEditor
                    draft={draft}
                    mode="edit"
                    saving={saving}
                    setDraft={setDraft}
                    onCancel={cancelEditor}
                    onSave={() => void saveTemplate()}
                    error={formError}
                  />
                ) : (
                  <View style={styles.hierarchy}>
                    <Text style={styles.hierarchyTitle}>Cấu trúc mẫu phiếu</Text>
                    {selected.sections.length === 0 ? (
                      <Text style={styles.bodyText}>Máy chủ chưa trả về phần nào trong mẫu phiếu này.</Text>
                    ) : selected.sections.map((section) => (
                      <View key={section.section_id} style={styles.sectionCard}>
                        <Text style={styles.sectionHeading}>
                          {section.order ? `${section.order}. ` : ''}{section.title}
                        </Text>
                        <Text style={styles.metaText}>
                          Người điền: {section.filled_by === 'patdoc'
                            ? 'Bệnh nhân và bác sĩ'
                            : section.filled_by === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân'}
                          {section.is_required === 1 ? ' · Bắt buộc' : ''}
                        </Text>
                        {(section.questions ?? []).length === 0 ? (
                          <Text style={styles.bodyText}>Chưa có câu hỏi.</Text>
                        ) : (section.questions ?? []).map((question) => (
                          <View key={question.question_id} style={styles.questionCard}>
                            <Text style={styles.questionTitle}>
                              {question.order ? `${question.order}. ` : ''}{question.question_text}
                              {question.is_required === 1 ? ' *' : ''}
                            </Text>
                            <Text style={styles.metaText}>
                              Mã: {question.question_id} · Loại: {question.type_question}
                            </Text>
                            {question.placeholder ? <Text style={styles.metaText}>Gợi ý nhập: {question.placeholder}</Text> : null}
                            {question.help_text ? <Text style={styles.bodyText}>{question.help_text}</Text> : null}
                            {question.parent_question_id ? (
                              <Text style={styles.metaText}>Câu hỏi cha: {question.parent_question_id}</Text>
                            ) : null}
                            {question.show_if_answer ? (
                              <Text style={styles.metaText}>Hiển thị khi: {question.show_if_answer}</Text>
                            ) : null}
                            {question.condition_rules ? (
                              <Text style={styles.metaText}>Quy tắc điều kiện: {question.condition_rules}</Text>
                            ) : null}
                            {question.allow_image === 1 ? <Text style={styles.metaText}>Cho phép đính kèm ảnh</Text> : null}
                            {(question.options ?? []).map((option) => (
                              <Text key={option.id} style={styles.optionText}>
                                • {option.option_text} ({option.option_value})
                                {option.trigger_image_upload === 1 ? ' · Gợi ý tải ảnh' : ''}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    ))}
                    {isAdmin && session ? (
                      <TemplateAuthoring
                        session={session}
                        template={selected}
                        onTemplateChange={(updated, message) => {
                          setSelected(updated);
                          setNotice(message);
                        }}
                        onDirtyChange={handleAuthoringDirtyChange}
                      />
                    ) : null}
                  </View>
                )}
              </>
            ) : null}
          </View>
        ) : creating ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Tạo mẫu phiếu</Text>
            <TemplateEditor
              draft={draft}
              mode="create"
              saving={saving}
              setDraft={setDraft}
              onCancel={cancelEditor}
              onSave={() => void saveTemplate()}
              error={formError}
            />
          </View>
        ) : (
          <View style={styles.panel}>
            <View style={styles.listHeader}>
              <Text style={styles.sectionTitle}>Mẫu phiếu</Text>
              {isAdmin ? <ActionButton label="＋ Tạo mẫu mới" onPress={openCreateForm} /> : null}
            </View>
            <View accessibilityLabel="Lọc trạng thái mẫu phiếu" style={styles.filterRow}>
              <FilterButton label="Tất cả" selected={filter === 'all'} onPress={() => selectFilter('all')} />
              <FilterButton label="Đang hoạt động" selected={filter === '1'} onPress={() => selectFilter('1')} />
              <FilterButton label="Không hoạt động" selected={filter === '0'} onPress={() => selectFilter('0')} />
            </View>

            {loading ? <ActivityIndicator accessibilityLabel="Đang tải danh sách mẫu phiếu" color={appColors.primary} style={styles.loading} /> : null}
            {!loading && !error && templates.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.sectionHeading}>Chưa có mẫu phiếu để hiển thị</Text>
                <Text style={styles.bodyText}>Danh sách trống theo phản hồi hiện tại của máy chủ.</Text>
              </View>
            ) : null}
            {templates.map((template) => (
              <Pressable
                accessibilityRole="button"
                key={template.code_template}
                onPress={() => void loadDetail(template.code_template)}
                style={({ pressed }) => [styles.templateRow, pressed && styles.pressed]}>
                <View style={styles.templateCopy}>
                  <Text style={styles.templateName}>{template.name}</Text>
                  <Text style={styles.code}>{template.code_template}</Text>
                  {template.description ? <Text numberOfLines={2} style={styles.bodyText}>{template.description}</Text> : null}
                </View>
                <View style={styles.templateAside}>
                  <Text style={[
                    styles.status,
                    template.is_active === '0' && styles.inactiveStatus,
                    !template.is_active && styles.unknownStatus,
                  ]}>
                    {template.is_active === '0'
                      ? 'Không hoạt động'
                      : template.is_active === '1' ? 'Hoạt động' : 'Chưa rõ trạng thái'}
                  </Text>
                  <Text style={styles.openLink}>Xem chi tiết →</Text>
                </View>
              </Pressable>
            ))}

            {total > 0 ? (
              <View style={styles.pagination}>
                <Text style={styles.metaText}>Trang {page} / {maxPage} · {total} mẫu</Text>
                <View style={styles.actionRow}>
                  <ActionButton label="Trước" onPress={() => startPage(page - 1)} secondary disabled={page <= 1 || loading} />
                  <ActionButton label="Tiếp" onPress={() => startPage(page + 1)} secondary disabled={page >= maxPage || loading} />
                </View>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TemplateEditor({
  draft,
  mode,
  saving,
  setDraft,
  onCancel,
  onSave,
  error,
}: {
  draft: TemplateDraft;
  mode: 'create' | 'edit';
  saving: boolean;
  setDraft: (draft: TemplateDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  error: string;
}) {
  return (
    <View style={styles.editor}>
      <FormField
        label="Mã mẫu phiếu"
        value={draft.code_template}
        editable={mode === 'create'}
        autoCapitalize="characters"
        placeholder="Ví dụ: TPL_CHRONIC_V1"
        onChangeText={(code_template) => setDraft({ ...draft, code_template })}
      />
      <FormField
        label="Tên mẫu phiếu"
        value={draft.name}
        placeholder="Nhập tên mẫu phiếu"
        onChangeText={(name) => setDraft({ ...draft, name })}
      />
      <FormField
        label="Mô tả"
        value={draft.description}
        multiline
        placeholder="Mô tả ngắn (không bắt buộc)"
        onChangeText={(description) => setDraft({ ...draft, description })}
      />
      <FormField
        label="Phiên bản"
        value={draft.version}
        placeholder="Ví dụ: 1.0"
        onChangeText={(version) => setDraft({ ...draft, version })}
      />
      <Text style={styles.fieldLabel}>Trạng thái do máy chủ hỗ trợ</Text>
      {!draft.is_active ? (
        <Text style={styles.metaText}>
          Máy chủ chưa cung cấp trạng thái; nếu không chọn, yêu cầu cập nhật sẽ giữ nguyên trường này.
        </Text>
      ) : null}
      <View style={styles.filterRow}>
        <FilterButton label="Hoạt động" selected={draft.is_active === '1'} onPress={() => setDraft({ ...draft, is_active: '1' })} />
        <FilterButton label="Không hoạt động" selected={draft.is_active === '0'} onPress={() => setDraft({ ...draft, is_active: '0' })} />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actionRow}>
        <ActionButton label="Hủy" onPress={onCancel} secondary disabled={saving} />
        <ActionButton label={saving ? 'Đang lưu…' : 'Lưu'} onPress={onSave} disabled={saving} />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        danger && styles.dangerButton,
        disabled && styles.disabledButton,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function FilterButton({
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
      style={[styles.filterButton, selected && styles.selectedFilter]}>
      <Text style={[styles.filterText, selected && styles.selectedFilterText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: appColors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: 960, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 28, paddingBottom: 44 },
  eyebrow: { color: appColors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, fontFamily: typography.medium },
  title: { marginTop: 12, color: appColors.ink, fontFamily: typography.extraBold, fontSize: fontSizes['3xl'], lineHeight: 36 },
  subtitle: { marginTop: 9, color: appColors.muted, fontSize: 15, lineHeight: 23 },
  panel: { marginTop: 24, borderWidth: 1, borderColor: appColors.border, borderRadius: 20, backgroundColor: appColors.surface, padding: 20 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  sectionTitle: { color: appColors.ink, fontSize: 22, fontWeight: '800', fontFamily: typography.medium },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, marginBottom: 6 },
  filterButton: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: appColors.border, borderRadius: 999, paddingHorizontal: 13 },
  selectedFilter: { backgroundColor: appColors.primarySoft, borderColor: appColors.primary },
  filterText: { color: appColors.muted, fontSize: 13, fontWeight: '700', fontFamily: typography.medium },
  selectedFilterText: { color: appColors.primary, fontFamily: typography.medium },
  templateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: appColors.border, paddingVertical: 17 },
  templateCopy: { flex: 1, minWidth: 180, gap: 4 },
  templateName: { color: appColors.ink, fontSize: 16, fontWeight: '800', fontFamily: typography.medium },
  templateAside: { alignItems: 'flex-end', gap: 8 },
  status: { color: appColors.primary, fontSize: 12, fontWeight: '700' },
  inactiveStatus: { color: appColors.warmInk },
  unknownStatus: { color: appColors.muted },
  openLink: { color: appColors.primary, fontSize: 13, fontWeight: '700' },
  code: { color: appColors.muted, fontSize: 12 },
  bodyText: { color: appColors.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  metaText: { color: appColors.muted, fontSize: 13, lineHeight: 20 },
  pagination: { alignItems: 'center', borderTopWidth: 1, borderTopColor: appColors.border, paddingTop: 16, gap: 12 },
  loading: { marginVertical: 24 },
  emptyCard: { marginTop: 12, borderRadius: 14, backgroundColor: appColors.canvas, padding: 17 },
  errorCard: { marginTop: 16, borderRadius: 14, borderWidth: 1, borderColor: '#E8B4B4', backgroundColor: '#FFF5F5', padding: 15, gap: 12 },
  error: { marginTop: 10, color: '#A61B1B', fontSize: 14, lineHeight: 21 },
  success: { marginTop: 18, borderRadius: 12, backgroundColor: '#EAF7F0', color: '#176B45', padding: 13, fontSize: 14, lineHeight: 21 },
  actionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: appColors.primary, paddingHorizontal: 15, paddingVertical: 9 },
  secondaryButton: { borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  dangerButton: { backgroundColor: '#A61B1B' },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: appColors.surface, fontSize: 14, fontWeight: '800' },
  secondaryButtonText: { color: appColors.ink },
  pressed: { opacity: 0.75 },
  metadata: { gap: 5, marginTop: 11 },
  hierarchy: { marginTop: 26 },
  hierarchyTitle: { color: appColors.ink, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  sectionCard: { borderRadius: 14, backgroundColor: appColors.canvas, padding: 15, marginBottom: 12 },
  sectionHeading: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  questionCard: { marginTop: 12, borderLeftWidth: 3, borderLeftColor: appColors.primary, paddingLeft: 12 },
  questionTitle: { color: appColors.ink, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  optionText: { color: appColors.muted, fontSize: 13, lineHeight: 20, marginTop: 4 },
  hint: { color: appColors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  confirmCard: { marginTop: 16, borderRadius: 14, backgroundColor: '#FFF8E6', padding: 15 },
  confirmTitle: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  editor: { marginTop: 12, gap: 12 },
  field: { gap: 6 },
  fieldLabel: { color: appColors.ink, fontSize: 14, fontWeight: '700' },
  input: { minHeight: 46, borderWidth: 1, borderColor: appColors.border, borderRadius: 11, backgroundColor: appColors.surface, color: appColors.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 86, textAlignVertical: 'top' },
  readOnlyInput: { backgroundColor: appColors.canvas, color: appColors.muted },
});
