import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';

import {
  optionsChanged,
  questionCreateInput,
  questionDraftFrom,
  questionTypes,
  questionUpdateInput,
  sectionCreateInput,
  sectionDraftFrom,
  sectionUpdateInput,
  validateQuestionDraft,
  validateSectionDraft,
  type QuestionDraft,
  type QuestionOptionDraft,
  type SectionDraft,
} from './template-authoring-form';
import {
  templatesApi,
  type TemplateDetail,
  type TemplateQuestion,
  type TemplateSection,
} from './templates-api';

type Props = {
  session: Session;
  template: TemplateDetail;
  onTemplateChange: (template: TemplateDetail, notice: string) => void;
  onDirtyChange: (dirty: boolean) => void;
};

type SectionEditor = {
  sectionId: number | null;
  draft: SectionDraft;
  original: SectionDraft;
};

type QuestionEditor = {
  sectionId: number;
  questionId: string | null;
  draft: QuestionDraft;
  original: QuestionDraft;
};

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể hoàn tất yêu cầu. Hãy thử lại.';
}

function SectionToggle({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.toggle}>
      <Text style={styles.toggleMark}>{checked ? '✓' : ' '}</Text>
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  readOnly = false,
  keyboardType = 'default',
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  multiline?: boolean;
  readOnly?: boolean;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!readOnly}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={appColors.muted}
        style={[styles.input, multiline && styles.multiline, readOnly && styles.readOnly]}
        value={value}
      />
    </View>
  );
}

function Action({
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
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export function TemplateAuthoring({
  session,
  template,
  onTemplateChange,
  onDirtyChange,
}: Props) {
  const [sectionEditor, setSectionEditor] = useState<SectionEditor | null>(null);
  const [questionEditor, setQuestionEditor] = useState<QuestionEditor | null>(null);
  const [error, setError] = useState('');
  const [refreshWarning, setRefreshWarning] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionDeleteId, setSectionDeleteId] = useState<number | null>(null);
  const [questionDeleteId, setQuestionDeleteId] = useState<string | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [optionDeleteIndex, setOptionDeleteIndex] = useState<number | null>(null);

  const sectionDirty = !!sectionEditor &&
    JSON.stringify(sectionEditor.draft) !== JSON.stringify(sectionEditor.original);
  const questionDirty = !!questionEditor &&
    JSON.stringify(questionEditor.draft) !== JSON.stringify(questionEditor.original);
  const dirty = sectionDirty || questionDirty;

  const editorOpen = !!sectionEditor || !!questionEditor;
  const sortedSections = useMemo(
    () => [...template.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [template.sections],
  );

  function startSectionEditor(section?: TemplateSection) {
    if (editorOpen) return;
    const draft = sectionDraftFrom(section, template.sections.length + 1);
    setSectionEditor({
      sectionId: section?.section_id ?? null,
      draft,
      original: draft,
    });
    onDirtyChange(false);
    setQuestionEditor(null);
    setError('');
    setDiscardPrompt(false);
    setSectionDeleteId(null);
    setQuestionDeleteId(null);
  }

  function startQuestionEditor(sectionId: number, question?: TemplateQuestion) {
    if (editorOpen) return;
    const section = template.sections.find((candidate) => candidate.section_id === sectionId);
    const draft = questionDraftFrom(question, (section?.questions?.length ?? 0) + 1);
    setQuestionEditor({
      sectionId,
      questionId: question?.question_id ?? null,
      draft,
      original: draft,
    });
    onDirtyChange(false);
    setSectionEditor(null);
    setError('');
    setDiscardPrompt(false);
    setSectionDeleteId(null);
    setQuestionDeleteId(null);
  }

  function requestCloseEditor() {
    if (dirty) {
      setDiscardPrompt(true);
      return;
    }
    setSectionEditor(null);
    setQuestionEditor(null);
    onDirtyChange(false);
    setError('');
    setDiscardPrompt(false);
    setOptionDeleteIndex(null);
  }

  function discardEditor() {
    setSectionEditor(null);
    setQuestionEditor(null);
    onDirtyChange(false);
    setError('');
    setDiscardPrompt(false);
    setOptionDeleteIndex(null);
  }

  async function finishWrite(notice: string, fallback: TemplateDetail) {
    onTemplateChange(fallback, notice);
    setRefreshWarning('');
    try {
      const refreshed = await templatesApi.get(session, template.code_template);
      onTemplateChange(refreshed, notice);
    } catch (refreshError) {
      setRefreshWarning(
        `Máy chủ đã xác nhận thao tác, nhưng không tải lại được cấu trúc mẫu phiếu: ${messageFrom(refreshError)}`,
      );
    }
  }

  async function reloadTemplate() {
    setRefreshing(true);
    setRefreshWarning('');
    try {
      const refreshed = await templatesApi.get(session, template.code_template);
      onTemplateChange(refreshed, 'Đã tải lại cấu trúc mẫu phiếu từ máy chủ.');
    } catch (refreshError) {
      setRefreshWarning(
        `Không tải lại được cấu trúc mẫu phiếu từ máy chủ: ${messageFrom(refreshError)}`,
      );
    } finally {
      setRefreshing(false);
    }
  }

  function updateTemplateSections(sections: TemplateSection[]): TemplateDetail {
    return { ...template, sections };
  }

  async function saveSection() {
    if (!sectionEditor) return;
    const validation = validateSectionDraft(sectionEditor.draft);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const saved = sectionEditor.sectionId === null
        ? await templatesApi.createSection(
            session,
            template.code_template,
            sectionCreateInput(sectionEditor.draft),
          )
        : await templatesApi.updateSection(
            session,
            sectionEditor.sectionId,
            sectionUpdateInput(sectionEditor.draft),
          );
      const sections = sectionEditor.sectionId === null
        ? [...template.sections, { ...saved, questions: saved.questions ?? [] }]
        : template.sections.map((item) =>
            item.section_id === saved.section_id ? { ...item, ...saved } : item,
          );
      const notice = sectionEditor.sectionId === null
        ? `Đã thêm phần “${saved.title}”.`
        : `Đã cập nhật phần “${saved.title}”.`;
      setSectionEditor(null);
      onDirtyChange(false);
      await finishWrite(notice, updateTemplateSections(sections));
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(section: TemplateSection) {
    setSaving(true);
    setError('');
    try {
      await templatesApi.removeSection(session, section.section_id);
      const sections = template.sections.filter((item) => item.section_id !== section.section_id);
      setSectionDeleteId(null);
      await finishWrite(
        `Đã xóa phần “${section.title}” theo phản hồi của máy chủ.`,
        updateTemplateSections(sections),
      );
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function saveQuestion() {
    if (!questionEditor) return;
    const mode = questionEditor.questionId === null ? 'create' : 'edit';
    const validation = validateQuestionDraft(questionEditor.draft, mode);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const draft = questionEditor.draft;
      const saved = questionEditor.questionId === null
        ? await templatesApi.createQuestion(
            session,
            questionEditor.sectionId,
            questionCreateInput(draft),
          )
        : await templatesApi.updateQuestion(
            session,
            questionEditor.questionId,
            questionUpdateInput(draft, optionsChanged(draft, questionEditor.original)),
          );
      const section = template.sections.find(
        (item) => item.section_id === questionEditor.sectionId,
      );
      const previousQuestion = section?.questions?.find(
        (question) => question.question_id === questionEditor.questionId,
      );
      const savedQuestion: TemplateQuestion = {
        ...saved,
        question_id: saved.question_id || draft.question_id,
        question_text: saved.question_text || draft.question_text.trim(),
        type_question: saved.type_question || draft.type_question,
        order: saved.order ?? Number(draft.order),
        is_required: saved.is_required ?? draft.is_required,
        allow_image: saved.allow_image ?? draft.allow_image,
        placeholder: saved.placeholder ?? (draft.placeholder.trim() || null),
        help_text: saved.help_text ?? (draft.help_text.trim() || null),
        show_if_answer: saved.show_if_answer ?? (draft.show_if_answer.trim() || null),
        parent_question_id: saved.parent_question_id ?? previousQuestion?.parent_question_id ?? draft.parent_question_id,
        condition_rules: saved.condition_rules ?? previousQuestion?.condition_rules,
        options: saved.options ?? (mode === 'edit' ? previousQuestion?.options : undefined),
      };
      const sections = template.sections.map((item) => {
        if (item.section_id !== questionEditor.sectionId) return item;
        const questions = item.questions ?? [];
        return {
          ...item,
          questions: mode === 'create'
            ? [...questions, savedQuestion]
            : questions.map((question) =>
                question.question_id === questionEditor.questionId ? savedQuestion : question,
              ),
        };
      });
      setQuestionEditor(null);
      onDirtyChange(false);
      await finishWrite(
        mode === 'create'
          ? `Đã thêm câu hỏi “${savedQuestion.question_text}”.`
          : `Đã cập nhật câu hỏi “${savedQuestion.question_text}”.`,
        updateTemplateSections(sections),
      );
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(question: TemplateQuestion, sectionId: number) {
    setSaving(true);
    setError('');
    try {
      await templatesApi.removeQuestion(session, question.question_id);
      const sections = template.sections.map((item) =>
        item.section_id === sectionId
          ? {
              ...item,
              questions: (item.questions ?? []).filter(
                (candidate) => candidate.question_id !== question.question_id,
              ),
            }
          : item,
      );
      setQuestionDeleteId(null);
      await finishWrite(
        `Đã xóa câu hỏi “${question.question_text}” theo phản hồi của máy chủ.`,
        updateTemplateSections(sections),
      );
    } catch (requestError) {
      setError(messageFrom(requestError));
    } finally {
      setSaving(false);
    }
  }

  function patchQuestionDraft(patch: Partial<QuestionDraft>) {
    if (!questionEditor) return;
    const draft = { ...questionEditor.draft, ...patch };
    setQuestionEditor({ ...questionEditor, draft });
    onDirtyChange(JSON.stringify(draft) !== JSON.stringify(questionEditor.original));
    setError('');
  }

  function patchSectionDraft(draft: SectionDraft) {
    if (!sectionEditor) return;
    setSectionEditor({ ...sectionEditor, draft });
    onDirtyChange(JSON.stringify(draft) !== JSON.stringify(sectionEditor.original));
    setError('');
  }

  function patchOption(index: number, patch: Partial<QuestionOptionDraft>) {
    if (!questionEditor) return;
    patchQuestionDraft({
      options: questionEditor.draft.options.map((option, current) =>
        current === index ? { ...option, ...patch } : option,
      ),
    });
  }

  function addOption() {
    if (!questionEditor) return;
    patchQuestionDraft({
      options: [
        ...questionEditor.draft.options,
        {
          option_text: '',
          option_value: '',
          order: String(questionEditor.draft.options.length + 1),
          trigger_image_upload: 0,
        },
      ],
    });
  }

  function confirmRemoveOption(index: number) {
    if (!questionEditor) return;
    patchQuestionDraft({
      options: questionEditor.draft.options.filter((_, current) => current !== index),
    });
    setOptionDeleteIndex(null);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.heading}>Soạn thảo phần và câu hỏi</Text>
          <Text style={styles.description}>
            Thay đổi chỉ được xác nhận sau khi máy chủ trả về thành công. Xóa phần sẽ xóa kèm câu hỏi và lựa chọn.
          </Text>
        </View>
        {!editorOpen ? (
          <Action label="Thêm phần" onPress={() => startSectionEditor()} />
        ) : null}
      </View>

      {refreshWarning ? (
        <View style={styles.warningCard}>
          <Text accessibilityRole="alert" style={styles.warning}>{refreshWarning}</Text>
          <Action
            label={refreshing ? 'Đang tải…' : 'Tải lại cấu trúc'}
            secondary
            disabled={refreshing}
            onPress={() => void reloadTemplate()}
          />
        </View>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

      {sectionEditor?.sectionId === null ? (
        <SectionEditorForm
          draft={sectionEditor.draft}
          mode="create"
          saving={saving}
          error={error}
          onChange={patchSectionDraft}
          onCancel={requestCloseEditor}
          onSave={() => void saveSection()}
        />
      ) : null}

      {sortedSections.length === 0 && !sectionEditor ? (
        <Text style={styles.empty}>Máy chủ chưa trả về phần nào trong mẫu phiếu này.</Text>
      ) : null}

      {sortedSections.map((section) => {
        const editingSection = sectionEditor?.sectionId === section.section_id;
        return (
          <View key={section.section_id} style={styles.sectionCard}>
            {editingSection && sectionEditor ? (
              <SectionEditorForm
                draft={sectionEditor.draft}
                mode="edit"
                saving={saving}
                error={error}
                onChange={patchSectionDraft}
                onCancel={requestCloseEditor}
                onSave={() => void saveSection()}
              />
            ) : (
              <>
                <View style={styles.itemHeader}>
                  <View style={styles.itemCopy}>
                    <Text style={styles.sectionTitle}>
                      {section.order ? `${section.order}. ` : ''}{section.title}
                    </Text>
                    <Text style={styles.meta}>
                      Người điền: {section.filled_by === 'patdoc'
                        ? 'Bệnh nhân và bác sĩ'
                        : section.filled_by === 'doctor' ? 'Bác sĩ' : 'Bệnh nhân'}
                      {section.is_required === 1 ? ' · Bắt buộc' : ''}
                    </Text>
                  </View>
                  {!editorOpen ? (
                    <View style={styles.actions}>
                      <Action label="Sửa phần" secondary onPress={() => startSectionEditor(section)} />
                      <Action
                        label="Xóa phần"
                        danger
                        onPress={() => {
                          setSectionDeleteId(section.section_id);
                          setError('');
                        }}
                      />
                    </View>
                  ) : null}
                </View>

                {sectionDeleteId === section.section_id ? (
                  <View style={styles.confirmCard}>
                    <Text style={styles.confirmTitle}>Xóa phần “{section.title}”?</Text>
                    <Text style={styles.meta}>
                      Máy chủ sẽ xóa cả câu hỏi và lựa chọn nằm trong phần này.
                    </Text>
                    <View style={styles.actions}>
                      <Action label="Hủy" secondary disabled={saving} onPress={() => setSectionDeleteId(null)} />
                      <Action
                        label={saving ? 'Đang xóa…' : 'Xác nhận xóa phần'}
                        danger
                        disabled={saving}
                        onPress={() => void deleteSection(section)}
                      />
                    </View>
                  </View>
                ) : null}

                {(section.questions ?? []).length === 0 ? (
                  <Text style={styles.empty}>Chưa có câu hỏi.</Text>
                ) : (section.questions ?? []).map((question) => (
                  <QuestionItem
                    key={question.question_id}
                    question={question}
                    editor={questionEditor?.questionId === question.question_id ? questionEditor : null}
                    editorOpen={editorOpen}
                    saving={saving}
                    error={questionEditor?.questionId === question.question_id ? error : ''}
                    deletePending={questionDeleteId === question.question_id}
                    onEdit={() => startQuestionEditor(section.section_id, question)}
                    onDelete={() => {
                      setQuestionDeleteId(question.question_id);
                      setError('');
                    }}
                    onCancel={requestCloseEditor}
                    onSave={() => void saveQuestion()}
                    onDraftChange={patchQuestionDraft}
                    onAddOption={addOption}
                    onOptionChange={patchOption}
                    onRequestOptionDelete={setOptionDeleteIndex}
                    optionDeleteIndex={optionDeleteIndex}
                    onConfirmOptionDelete={confirmRemoveOption}
                    onCancelOptionDelete={() => setOptionDeleteIndex(null)}
                    onConfirmDelete={() => void deleteQuestion(question, section.section_id)}
                    onCancelDelete={() => setQuestionDeleteId(null)}
                  />
                ))}

                {!editorOpen ? (
                  <Action
                    label="Thêm câu hỏi"
                    secondary
                    onPress={() => startQuestionEditor(section.section_id)}
                  />
                ) : null}
                {questionEditor?.sectionId === section.section_id && questionEditor.questionId === null ? (
                  <QuestionEditorForm
                    editor={questionEditor}
                    mode="create"
                    saving={saving}
                    error={error}
                    optionDeleteIndex={optionDeleteIndex}
                    onDraftChange={patchQuestionDraft}
                    onAddOption={addOption}
                    onOptionChange={patchOption}
                    onRequestOptionDelete={setOptionDeleteIndex}
                    onConfirmOptionDelete={confirmRemoveOption}
                    onCancelOptionDelete={() => setOptionDeleteIndex(null)}
                    onCancel={requestCloseEditor}
                    onSave={() => void saveQuestion()}
                  />
                ) : null}
              </>
            )}
          </View>
        );
      })}

      {discardPrompt ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Bỏ các thay đổi chưa lưu?</Text>
          <Text style={styles.meta}>Nội dung chưa gửi lên máy chủ sẽ bị mất.</Text>
          <View style={styles.actions}>
            <Action label="Tiếp tục chỉnh sửa" secondary onPress={() => setDiscardPrompt(false)} />
            <Action label="Bỏ thay đổi" danger onPress={discardEditor} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function SectionEditorForm({
  draft,
  mode,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  draft: SectionDraft;
  mode: 'create' | 'edit';
  saving: boolean;
  error: string;
  onChange: (draft: SectionDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{mode === 'create' ? 'Thêm phần' : 'Chỉnh sửa phần'}</Text>
      <Field label="Tên phần" value={draft.title} onChangeText={(title) => onChange({ ...draft, title })} />
      <Field
        label="Thứ tự phần"
        value={draft.order}
        keyboardType="numeric"
        onChangeText={(order) => onChange({ ...draft, order })}
      />
      <Text style={styles.fieldLabel}>Người điền</Text>
      <View style={styles.choiceRow}>
        {([
          ['patient', 'Bệnh nhân'],
          ['doctor', 'Bác sĩ'],
          ['patdoc', 'Cả hai'],
        ] as const).map(([value, label]) => (
          <Action
            key={value}
            label={label}
            secondary={draft.filled_by !== value}
            onPress={() => onChange({ ...draft, filled_by: value })}
          />
        ))}
      </View>
      <SectionToggle
        label="Bắt buộc điền"
        checked={draft.is_required === 1}
        onPress={() => onChange({ ...draft, is_required: draft.is_required === 1 ? 0 : 1 })}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Action label="Hủy" secondary disabled={saving} onPress={onCancel} />
        <Action label={saving ? 'Đang lưu…' : 'Lưu phần'} disabled={saving} onPress={onSave} />
      </View>
    </View>
  );
}

function QuestionItem({
  question,
  editor,
  editorOpen,
  saving,
  error,
  deletePending,
  onEdit,
  onDelete,
  onCancel,
  onSave,
  onDraftChange,
  onAddOption,
  onOptionChange,
  onRequestOptionDelete,
  optionDeleteIndex,
  onConfirmOptionDelete,
  onCancelOptionDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  question: TemplateQuestion;
  editor: QuestionEditor | null;
  editorOpen: boolean;
  saving: boolean;
  error: string;
  deletePending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDraftChange: (patch: Partial<QuestionDraft>) => void;
  onAddOption: () => void;
  onOptionChange: (index: number, patch: Partial<QuestionOptionDraft>) => void;
  onRequestOptionDelete: (index: number | null) => void;
  optionDeleteIndex: number | null;
  onConfirmOptionDelete: (index: number) => void;
  onCancelOptionDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  if (editor) {
    return (
      <QuestionEditorForm
        editor={editor}
        mode="edit"
        saving={saving}
        error={error}
        optionDeleteIndex={optionDeleteIndex}
        onDraftChange={onDraftChange}
        onAddOption={onAddOption}
        onOptionChange={onOptionChange}
        onRequestOptionDelete={onRequestOptionDelete}
        onConfirmOptionDelete={onConfirmOptionDelete}
        onCancelOptionDelete={onCancelOptionDelete}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  return (
    <View style={styles.questionCard}>
      <View style={styles.itemHeader}>
        <View style={styles.itemCopy}>
          <Text style={styles.questionTitle}>
            {question.order ? `${question.order}. ` : ''}{question.question_text}
            {question.is_required === 1 ? ' *' : ''}
          </Text>
          <Text style={styles.meta}>Mã: {question.question_id} · Loại: {question.type_question}</Text>
        </View>
        {!editorOpen ? (
          <View style={styles.actions}>
            <Action label="Sửa câu hỏi" secondary onPress={onEdit} />
            <Action label="Xóa câu hỏi" danger onPress={onDelete} />
          </View>
        ) : null}
      </View>
      {question.placeholder ? <Text style={styles.meta}>Gợi ý nhập: {question.placeholder}</Text> : null}
      {question.help_text ? <Text style={styles.meta}>{question.help_text}</Text> : null}
      {question.parent_question_id ? (
        <Text style={styles.meta}>Câu hỏi cha: {question.parent_question_id}</Text>
      ) : null}
      {question.show_if_answer ? <Text style={styles.meta}>Hiển thị khi: {question.show_if_answer}</Text> : null}
      {question.condition_rules ? <Text style={styles.meta}>Quy tắc điều kiện: {question.condition_rules}</Text> : null}
      {question.allow_image === 1 ? <Text style={styles.meta}>Cho phép đính kèm ảnh</Text> : null}
      {(question.options ?? []).map((option) => (
        <Text key={option.id} style={styles.optionText}>
          • {option.option_text} ({option.option_value})
          {option.trigger_image_upload === 1 ? ' · Gợi ý tải ảnh' : ''}
        </Text>
      ))}
      {deletePending ? (
        <View style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>Xóa câu hỏi “{question.question_text}”?</Text>
          <Text style={styles.meta}>
            Máy chủ sẽ xóa các lựa chọn và câu hỏi con. Nếu câu hỏi đã được trả lời, máy chủ có thể từ chối yêu cầu.
          </Text>
          <View style={styles.actions}>
            <Action label="Hủy" secondary disabled={saving} onPress={onCancelDelete} />
            <Action
              label={saving ? 'Đang xóa…' : 'Xác nhận xóa câu hỏi'}
              danger
              disabled={saving}
              onPress={onConfirmDelete}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function QuestionEditorForm({
  editor,
  mode,
  saving,
  error,
  optionDeleteIndex,
  onDraftChange,
  onAddOption,
  onOptionChange,
  onRequestOptionDelete,
  onConfirmOptionDelete,
  onCancelOptionDelete,
  onCancel,
  onSave,
}: {
  editor: QuestionEditor;
  mode: 'create' | 'edit';
  saving: boolean;
  error: string;
  optionDeleteIndex: number | null;
  onDraftChange: (patch: Partial<QuestionDraft>) => void;
  onAddOption: () => void;
  onOptionChange: (index: number, patch: Partial<QuestionOptionDraft>) => void;
  onRequestOptionDelete: (index: number | null) => void;
  onConfirmOptionDelete: (index: number) => void;
  onCancelOptionDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const draft = editor.draft;
  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{mode === 'create' ? 'Thêm câu hỏi' : 'Chỉnh sửa câu hỏi'}</Text>
      {mode === 'create' ? (
        <Field
          label="Mã câu hỏi (tối đa 50 ký tự)"
          value={draft.question_id}
          onChangeText={(question_id) => onDraftChange({ question_id })}
          placeholder="Ví dụ: Q_ITCH"
        />
      ) : (
        <>
          <Field label="Mã câu hỏi" value={draft.question_id} readOnly />
          <Text style={styles.meta}>Loại câu hỏi không thể đổi qua API cập nhật.</Text>
          <Text style={styles.meta}>Câu hỏi cha không thể đổi qua API cập nhật.</Text>
        </>
      )}
      <Field
        label="Nội dung câu hỏi"
        value={draft.question_text}
        onChangeText={(question_text) => onDraftChange({ question_text })}
      />
      {mode === 'create' ? (
        <>
          <Text style={styles.fieldLabel}>Loại câu hỏi</Text>
          <View style={styles.choiceRow}>
            {questionTypes.map((type) => (
              <Action
                key={type.value}
                label={type.label}
                secondary={draft.type_question !== type.value}
                onPress={() => onDraftChange({ type_question: type.value })}
              />
            ))}
          </View>
        </>
      ) : (
        <Field label="Loại câu hỏi" value={draft.type_question} readOnly />
      )}
      <Field
        label="Thứ tự câu hỏi"
        value={draft.order}
        keyboardType="numeric"
        onChangeText={(order) => onDraftChange({ order })}
      />
      <Field
        label="Gợi ý nhập (không bắt buộc)"
        value={draft.placeholder}
        onChangeText={(placeholder) => onDraftChange({ placeholder })}
      />
      <Field
        label="Hướng dẫn (không bắt buộc)"
        value={draft.help_text}
        multiline
        onChangeText={(help_text) => onDraftChange({ help_text })}
      />
      {mode === 'create' ? (
        <Field
          label="Mã câu hỏi cha (không bắt buộc)"
          value={draft.parent_question_id}
          onChangeText={(parent_question_id) => onDraftChange({ parent_question_id })}
        />
      ) : (
        <Field label="Mã câu hỏi cha" value={draft.parent_question_id || 'Không có'} readOnly />
      )}
      <Field
        label="Điều kiện hiển thị (chuỗi JSON, không bắt buộc)"
        value={draft.show_if_answer}
        multiline
        onChangeText={(show_if_answer) => onDraftChange({ show_if_answer })}
        placeholder='Ví dụ: {"Q_ITCH":["yes"]}'
      />
      <SectionToggle
        label="Bắt buộc trả lời"
        checked={draft.is_required === 1}
        onPress={() => onDraftChange({ is_required: draft.is_required === 1 ? 0 : 1 })}
      />
      <SectionToggle
        label="Cho phép đính kèm ảnh"
        checked={draft.allow_image === 1}
        onPress={() => onDraftChange({ allow_image: draft.allow_image === 1 ? 0 : 1 })}
      />

      <View style={styles.optionHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.fieldLabel}>Lựa chọn</Text>
          <Text style={styles.meta}>
            Bắt buộc với loại “Chọn một”, “Chọn nhiều” và “Danh sách chọn”.
            Khi cập nhật, thay đổi lựa chọn sẽ đồng bộ danh sách trên máy chủ.
          </Text>
        </View>
        <Action label="Thêm lựa chọn" secondary onPress={onAddOption} />
      </View>
      {draft.options.map((option, index) => (
        <View key={option.id ?? `new-${index}`} style={styles.optionEditor}>
          <Text style={styles.formTitle}>Lựa chọn {index + 1}</Text>
          {option.id !== undefined ? (
            <Text style={styles.meta}>Mã lựa chọn: {option.id}</Text>
          ) : null}
          <Field
            label="Nội dung lựa chọn"
            value={option.option_text}
            onChangeText={(option_text) => onOptionChange(index, { option_text })}
          />
          <Field
            label="Giá trị lựa chọn"
            value={option.option_value}
            onChangeText={(option_value) => onOptionChange(index, { option_value })}
          />
          <Field
            label="Thứ tự lựa chọn (không bắt buộc)"
            value={option.order}
            keyboardType="numeric"
            onChangeText={(order) => onOptionChange(index, { order })}
          />
          <SectionToggle
            label="Lựa chọn này yêu cầu tải ảnh"
            checked={option.trigger_image_upload === 1}
            onPress={() => onOptionChange(index, {
              trigger_image_upload: option.trigger_image_upload === 1 ? 0 : 1,
            })}
          />
          <Action
            label="Gỡ lựa chọn"
            danger
            onPress={() => onRequestOptionDelete(index)}
          />
          {optionDeleteIndex === index ? (
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Gỡ lựa chọn này?</Text>
              <Text style={styles.meta}>
                Khi lưu, API đồng bộ danh sách lựa chọn; lựa chọn bị gỡ có thể không còn được liên kết với câu trả lời đã lưu.
              </Text>
              <View style={styles.actions}>
                <Action label="Hủy" secondary onPress={onCancelOptionDelete} />
                <Action label="Gỡ khỏi bản nháp" danger onPress={() => onConfirmOptionDelete(index)} />
              </View>
            </View>
          ) : null}
        </View>
      ))}
      {mode === 'edit' && editor.original.options.length > 0 ? (
        <Text style={styles.warning}>
          Nếu lưu sau khi thay đổi lựa chọn, API sẽ đồng bộ toàn bộ danh sách; lựa chọn cũ bị bỏ có thể làm mất liên kết đáp án.
        </Text>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Action label="Hủy" secondary disabled={saving} onPress={onCancel} />
        <Action label={saving ? 'Đang lưu…' : 'Lưu câu hỏi'} disabled={saving} onPress={onSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 22, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  headerCopy: { flex: 1, minWidth: 220, gap: 6 },
  heading: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  description: { color: appColors.muted, fontSize: 13, lineHeight: 20 },
  sectionCard: { borderRadius: 14, backgroundColor: appColors.canvas, padding: 15, gap: 12 },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  itemCopy: { flex: 1, minWidth: 190, gap: 5 },
  sectionTitle: { color: appColors.ink, fontSize: 16, fontWeight: '800' },
  questionCard: { marginTop: 6, borderTopWidth: 1, borderTopColor: appColors.border, paddingTop: 12, gap: 8 },
  questionTitle: { color: appColors.ink, fontSize: 14, fontWeight: '700', lineHeight: 21 },
  meta: { color: appColors.muted, fontSize: 13, lineHeight: 20 },
  optionText: { color: appColors.muted, fontSize: 13, lineHeight: 20, marginLeft: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: appColors.primary, paddingHorizontal: 13, paddingVertical: 8 },
  secondaryButton: { borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface },
  dangerButton: { backgroundColor: '#A61B1B' },
  disabled: { opacity: 0.55 },
  buttonText: { color: appColors.surface, fontSize: 13, fontWeight: '800' },
  secondaryText: { color: appColors.ink },
  pressed: { opacity: 0.75 },
  form: { marginTop: 6, borderRadius: 13, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface, padding: 14, gap: 12 },
  formTitle: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  field: { gap: 6 },
  fieldLabel: { color: appColors.ink, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 44, borderWidth: 1, borderColor: appColors.border, borderRadius: 10, backgroundColor: appColors.surface, color: appColors.ink, paddingHorizontal: 11, paddingVertical: 9, fontSize: 15 },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  readOnly: { backgroundColor: appColors.canvas, color: appColors.muted },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', paddingHorizontal: 4 },
  toggleMark: { width: 22, height: 22, textAlign: 'center', textAlignVertical: 'center', borderWidth: 1, borderColor: appColors.primary, borderRadius: 5, color: appColors.primary, fontWeight: '800' },
  toggleText: { color: appColors.ink, fontSize: 14 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  optionEditor: { borderTopWidth: 1, borderTopColor: appColors.border, paddingTop: 12, gap: 10 },
  confirmCard: { marginTop: 8, borderRadius: 12, backgroundColor: '#FFF8E6', padding: 13, gap: 7 },
  confirmTitle: { color: appColors.ink, fontSize: 15, fontWeight: '800' },
  warning: { borderRadius: 10, backgroundColor: '#FFF8E6', color: appColors.warmInk, padding: 12, fontSize: 13, lineHeight: 20 },
  warningCard: { borderRadius: 10, backgroundColor: '#FFF8E6', padding: 12, gap: 8 },
  error: { borderRadius: 10, backgroundColor: '#FFF5F5', color: '#A61B1B', padding: 11, fontSize: 14, lineHeight: 20 },
  empty: { color: appColors.muted, fontSize: 13, lineHeight: 20, paddingVertical: 8 },
});
