import {
  optionsChanged,
  questionCreateInput,
  questionDraftFrom,
  questionUpdateInput,
  sectionDraftFrom,
  sectionUpdateInput,
  validateQuestionDraft,
  validateSectionDraft,
} from '@/features/templates/template-authoring-form';
import type { TemplateQuestion, TemplateSection } from '@/features/templates/templates-api';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toBeNull(): void;
};

const section: TemplateSection = {
  section_id: 4,
  title: 'Triệu chứng',
  order: 2,
  is_required: 1,
  filled_by: 'doctor',
  questions: [],
};

const question: TemplateQuestion = {
  question_id: 'Q_ITCH',
  question_text: 'Bạn có bị ngứa không?',
  type_question: 'radio',
  order: 1,
  is_required: 1,
  options: [
    { id: 101, option_text: 'Có', option_value: 'yes', order: 1 },
    { id: 102, option_text: 'Không', option_value: 'no', order: 2 },
  ],
};

describe('nested template authoring validation and payloads', () => {
  test('validates section title and integer order', () => {
    expect(validateSectionDraft({ ...sectionDraftFrom(section), title: ' ' })).toBe(
      'Vui lòng nhập tên phần.',
    );
    expect(validateSectionDraft({ ...sectionDraftFrom(section), order: '1.5' })).toBe(
      'Thứ tự phần phải là số nguyên.',
    );
    expect(sectionUpdateInput(sectionDraftFrom(section))).toEqual({
      title: 'Triệu chứng',
      order: 2,
      is_required: 1,
      filled_by: 'doctor',
    });
  });

  test('requires a valid question id, order, and choice options', () => {
    const draft = questionDraftFrom(question);
    expect(validateQuestionDraft({ ...draft, question_id: '' }, 'create')).toBe(
      'Vui lòng nhập mã câu hỏi.',
    );
    expect(
      validateQuestionDraft(
        { ...draft, question_id: 'Q'.repeat(51) },
        'create',
      ),
    ).toBe('Mã câu hỏi không được dài quá 50 ký tự.');
    expect(
      validateQuestionDraft({ ...draft, options: [] }, 'create'),
    ).toBe('Câu hỏi chọn đáp án cần có ít nhất một lựa chọn.');
    expect(
      validateQuestionDraft({ ...draft, show_if_answer: '{bad json}' }, 'edit'),
    ).toBe('Điều kiện hiển thị phải là chuỗi JSON hợp lệ.');
    expect(validateQuestionDraft(draft, 'edit')).toBeNull();
  });

  test('creates full supported fields and only synchronizes options after edits', () => {
    const draft = questionDraftFrom(question);
    expect(questionCreateInput(draft)).toEqual({
      question_id: 'Q_ITCH',
      question_text: 'Bạn có bị ngứa không?',
      type_question: 'radio',
      order: 1,
      placeholder: null,
      help_text: null,
      is_required: 1,
      allow_image: 0,
      show_if_answer: null,
      parent_question_id: null,
      options: [
        { option_text: 'Có', option_value: 'yes', order: 1, trigger_image_upload: 0 },
        { option_text: 'Không', option_value: 'no', order: 2, trigger_image_upload: 0 },
      ],
    });

    expect(optionsChanged(draft, questionDraftFrom(question))).toBe(false);
    const editedOptions = {
      ...draft,
      options: draft.options.slice(0, 1),
    };
    expect(optionsChanged(editedOptions, draft)).toBe(true);
    expect(questionUpdateInput(draft, false)).toEqual({
      question_text: 'Bạn có bị ngứa không?',
      order: 1,
      placeholder: null,
      help_text: null,
      is_required: 1,
      allow_image: 0,
      show_if_answer: null,
    });
    expect(questionUpdateInput(editedOptions, true).options).toEqual([
      {
        id: 101,
        option_text: 'Có',
        option_value: 'yes',
        order: 1,
        trigger_image_upload: 0,
      },
    ]);
  });
});
