import { describe, expect, test } from '@jest/globals';

import {
  createProfileDraft,
  getProfileChanges,
  validateProfileDraft,
} from '@/features/profile/profile-form';
import type { Profile } from '@/features/profile/profile-api';

const profile: Profile = {
  user_id: 15,
  full_name: 'Nguyễn Văn A',
  phone: '0912345678',
  recovery_email: 'user@example.com',
  role_id: 3,
  gender: 'male',
  year_of_birth: 1995,
  city_address: 'Hà Nội',
};

describe('profile editing', () => {
  test('builds a draft from the server profile without inventing values', () => {
    expect(createProfileDraft(profile)).toMatchObject({
      full_name: 'Nguyễn Văn A',
      gender: 'male',
      year_of_birth: '1995',
      city_address: 'Hà Nội',
      career: '',
    });
  });

  test('sends only changed fields and represents cleared nullable values as null', () => {
    const draft = createProfileDraft(profile);
    draft.full_name = '  Nguyễn Văn B ';
    draft.city_address = '';

    expect(getProfileChanges(profile, draft)).toEqual({
      full_name: 'Nguyễn Văn B',
      city_address: null,
    });
  });

  test('does not create an update request for an unchanged draft', () => {
    expect(getProfileChanges(profile, createProfileDraft(profile))).toEqual({});
  });

  test('rejects invalid name, year, and insurance date values', () => {
    const draft = createProfileDraft(profile);
    draft.full_name = ' ';
    expect(validateProfileDraft(draft)).toBe('Họ tên không được để trống.');

    draft.full_name = profile.full_name;
    draft.year_of_birth = '1995.5';
    expect(validateProfileDraft(draft)).toBe('Năm sinh phải là số nguyên.');

    draft.year_of_birth = '1995';
    draft.health_insurance_validate = '2026-02-31';
    expect(validateProfileDraft(draft)).toBe(
      'Hạn thẻ bảo hiểm phải theo định dạng YYYY-MM-DD.',
    );
  });
});
