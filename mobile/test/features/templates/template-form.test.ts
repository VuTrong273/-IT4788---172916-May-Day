import { validateTemplateDraft, type TemplateDraft } from '@/features/templates/template-form';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => {
  toBe(expected: unknown): void;
  toBeNull(): void;
};

const validDraft: TemplateDraft = {
  code_template: 'TPL_CHRONIC_V1',
  name: 'Mề đay mạn tính',
  description: '',
  version: '',
  is_active: '1',
};

describe('template form validation', () => {
  test('requires a client-supplied code and name when creating a template', () => {
    expect(validateTemplateDraft({ ...validDraft, code_template: ' ' }, 'create')).toBe(
      'Vui lòng nhập mã mẫu phiếu.',
    );
    expect(validateTemplateDraft({ ...validDraft, name: ' ' }, 'create')).toBe(
      'Vui lòng nhập tên mẫu phiếu.',
    );
  });

  test('keeps template codes immutable while editing and enforces the OpenAPI length limit', () => {
    expect(validateTemplateDraft({ ...validDraft, code_template: '' }, 'edit')).toBeNull();
    expect(
      validateTemplateDraft(
        { ...validDraft, code_template: 'T'.repeat(226) },
        'create',
      ),
    ).toBe('Mã mẫu phiếu không được dài quá 225 ký tự.');
  });
});
