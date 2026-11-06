import type {
  TemplateOption,
  TemplateOptionInput,
  TemplateQuestion,
  TemplateQuestionCreateInput,
  TemplateQuestionType,
  TemplateQuestionUpdateInput,
  TemplateSection,
  TemplateSectionInput,
  TemplateSectionUpdateInput,
} from './templates-api';

export type SectionDraft = {
  title: string;
  order: string;
  is_required: 0 | 1;
  filled_by: 'patient' | 'doctor' | 'patdoc';
};

export type QuestionOptionDraft = {
  id?: number;
  option_text: string;
  option_value: string;
  order: string;
  trigger_image_upload: 0 | 1;
};

export type QuestionDraft = {
  question_id: string;
  question_text: string;
  type_question: TemplateQuestionType;
  placeholder: string;
  help_text: string;
  order: string;
  is_required: 0 | 1;
  allow_image: 0 | 1;
  parent_question_id: string;
  show_if_answer: string;
  options: QuestionOptionDraft[];
};

export const questionTypes: { value: TemplateQuestionType; label: string }[] = [
  { value: 'text', label: 'Văn bản ngắn' },
  { value: 'textarea', label: 'Văn bản nhiều dòng' },
  { value: 'number', label: 'Số' },
  { value: 'date', label: 'Ngày' },
  { value: 'radio', label: 'Chọn một' },
  { value: 'checkbox', label: 'Chọn nhiều' },
  { value: 'select', label: 'Danh sách chọn' },
  { value: 'image', label: 'Tải ảnh' },
];

export function sectionDraftFrom(
  section?: TemplateSection,
  nextOrder = 1,
): SectionDraft {
  return {
    title: section?.title ?? '',
    order: String(section?.order ?? nextOrder),
    is_required: section?.is_required === 1 ? 1 : 0,
    filled_by: section?.filled_by ?? 'patient',
  };
}

function optionDraftFrom(option: TemplateOption, index: number): QuestionOptionDraft {
  return {
    id: option.id,
    option_text: option.option_text,
    option_value: option.option_value,
    order: String(option.order ?? index + 1),
    trigger_image_upload: option.trigger_image_upload === 1 ? 1 : 0,
  };
}

export function questionDraftFrom(
  question?: TemplateQuestion,
  nextOrder = 1,
): QuestionDraft {
  return {
    question_id: question?.question_id ?? '',
    question_text: question?.question_text ?? '',
    type_question: question?.type_question ?? 'text',
    placeholder: question?.placeholder ?? '',
    help_text: question?.help_text ?? '',
    order: String(question?.order ?? nextOrder),
    is_required: question?.is_required === 1 ? 1 : 0,
    allow_image: question?.allow_image === 1 ? 1 : 0,
    parent_question_id: question?.parent_question_id ?? '',
    show_if_answer: question?.show_if_answer ?? '',
    options: (question?.options ?? []).map(optionDraftFrom),
  };
}

function integerValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function validateSectionDraft(draft: SectionDraft): string | null {
  if (!draft.title.trim()) return 'Vui lòng nhập tên phần.';
  if (integerValue(draft.order) === null) return 'Thứ tự phần phải là số nguyên.';
  return null;
}

export function validateQuestionDraft(
  draft: QuestionDraft,
  mode: 'create' | 'edit',
): string | null {
  if (mode === 'create' && !draft.question_id.trim()) {
    return 'Vui lòng nhập mã câu hỏi.';
  }
  if (mode === 'create' && draft.question_id.trim().length > 50) {
    return 'Mã câu hỏi không được dài quá 50 ký tự.';
  }
  if (!draft.question_text.trim()) return 'Vui lòng nhập nội dung câu hỏi.';
  if (integerValue(draft.order) === null) return 'Thứ tự câu hỏi phải là số nguyên.';
  if (draft.show_if_answer.trim()) {
    try {
      JSON.parse(draft.show_if_answer);
    } catch {
      return 'Điều kiện hiển thị phải là chuỗi JSON hợp lệ.';
    }
  }
  if (['radio', 'checkbox', 'select'].includes(draft.type_question) && draft.options.length === 0) {
    return 'Câu hỏi chọn đáp án cần có ít nhất một lựa chọn.';
  }
  for (const [index, option] of draft.options.entries()) {
    if (!option.option_text.trim() || !option.option_value.trim()) {
      return `Vui lòng nhập nội dung và giá trị cho lựa chọn ${index + 1}.`;
    }
    if (option.order.trim() && integerValue(option.order) === null) {
      return `Thứ tự lựa chọn ${index + 1} phải là số nguyên.`;
    }
  }
  return null;
}

function sectionFields(draft: SectionDraft): TemplateSectionInput {
  return {
    title: draft.title.trim(),
    order: integerValue(draft.order) ?? 0,
    is_required: draft.is_required,
    filled_by: draft.filled_by,
  };
}

export function sectionCreateInput(draft: SectionDraft): TemplateSectionInput {
  return sectionFields(draft);
}

export function sectionUpdateInput(draft: SectionDraft): TemplateSectionUpdateInput {
  return sectionFields(draft);
}

function optionInputFromDraft(option: QuestionOptionDraft): TemplateOptionInput {
  const order = integerValue(option.order);
  return {
    ...(option.id === undefined ? {} : { id: option.id }),
    option_text: option.option_text.trim(),
    option_value: option.option_value.trim(),
    ...(order === null ? {} : { order }),
    trigger_image_upload: option.trigger_image_upload,
  };
}

function optionCreateInputFromDraft(option: QuestionOptionDraft) {
  const order = integerValue(option.order);
  return {
    option_text: option.option_text.trim(),
    option_value: option.option_value.trim(),
    ...(order === null ? {} : { order }),
    trigger_image_upload: option.trigger_image_upload,
  };
}

function commonQuestionFields(draft: QuestionDraft) {
  return {
    question_text: draft.question_text.trim(),
    order: integerValue(draft.order) ?? 0,
    placeholder: draft.placeholder.trim() || null,
    help_text: draft.help_text.trim() || null,
    is_required: draft.is_required,
    allow_image: draft.allow_image,
    show_if_answer: draft.show_if_answer.trim() || null,
  };
}

export function questionCreateInput(draft: QuestionDraft): TemplateQuestionCreateInput {
  return {
    question_id: draft.question_id.trim(),
    ...commonQuestionFields(draft),
    type_question: draft.type_question,
    parent_question_id: draft.parent_question_id.trim() || null,
    ...(draft.options.length ? { options: draft.options.map(optionCreateInputFromDraft) } : {}),
  };
}

export function questionUpdateInput(
  draft: QuestionDraft,
  optionsChanged: boolean,
): TemplateQuestionUpdateInput {
  return {
    ...commonQuestionFields(draft),
    ...(optionsChanged ? { options: draft.options.map(optionInputFromDraft) } : {}),
  };
}

export function optionsChanged(
  draft: QuestionDraft,
  original: QuestionDraft,
): boolean {
  return JSON.stringify(draft.options) !== JSON.stringify(original.options);
}
