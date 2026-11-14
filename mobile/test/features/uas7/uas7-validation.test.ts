import { isValidUas7Date, validateUas7ScoreDraft } from '@/features/uas7/uas7-validation';

declare const describe: (title: string, run: () => void) => void;
declare const test: (title: string, run: () => void) => void;
declare const expect: (value: unknown) => {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
};

describe('UAS7 form validation', () => {
  test('accepts a real ISO calendar date and scores from zero to three', () => {
    expect(isValidUas7Date('2026-02-28')).toBe(true);
    expect(validateUas7ScoreDraft({ scoreDate: '2026-02-28', iss7: '0', hss7: '3' })).toEqual({});
  });

  test('rejects invalid calendar dates, missing values, and out-of-range scores', () => {
    expect(isValidUas7Date('2026-02-29')).toBe(false);
    expect(validateUas7ScoreDraft({ scoreDate: '2026-13-01', iss7: '4', hss7: '' })).toEqual({
      scoreDate: 'Nhập ngày hợp lệ theo định dạng YYYY-MM-DD.',
      iss7: 'Chọn điểm ngứa từ 0 đến 3.',
      hss7: 'Chọn điểm số lượng mề đay từ 0 đến 3.',
    });
  });
});
