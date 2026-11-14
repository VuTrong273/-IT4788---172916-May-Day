export type TemplateDraft = {
  code_template: string;
  name: string;
  description: string;
  version: string;
  is_active?: '1' | '0';
};

export function validateTemplateDraft(
  draft: TemplateDraft,
  mode: 'create' | 'edit',
): string | null {
  if (mode === 'create' && !draft.code_template.trim()) {
    return 'Vui lòng nhập mã mẫu phiếu.';
  }
  if (mode === 'create' && draft.code_template.trim().length > 225) {
    return 'Mã mẫu phiếu không được dài quá 225 ký tự.';
  }
  if (!draft.name.trim()) {
    return 'Vui lòng nhập tên mẫu phiếu.';
  }
  return null;
}
