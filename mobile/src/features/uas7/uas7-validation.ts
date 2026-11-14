export type Uas7ScoreDraft = {
  scoreDate: string;
  iss7: string;
  hss7: string;
};

export type Uas7ValidationErrors = Partial<
  Record<'scoreDate' | 'iss7' | 'hss7', string>
>;

export function isValidUas7Date(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateUas7ScoreDraft(
  draft: Uas7ScoreDraft,
): Uas7ValidationErrors {
  const errors: Uas7ValidationErrors = {};
  if (!isValidUas7Date(draft.scoreDate)) {
    errors.scoreDate = 'Nhập ngày hợp lệ theo định dạng YYYY-MM-DD.';
  }
  if (!['0', '1', '2', '3'].includes(draft.iss7)) {
    errors.iss7 = 'Chọn điểm ngứa từ 0 đến 3.';
  }
  if (!['0', '1', '2', '3'].includes(draft.hss7)) {
    errors.hss7 = 'Chọn điểm số lượng mề đay từ 0 đến 3.';
  }
  return errors;
}
