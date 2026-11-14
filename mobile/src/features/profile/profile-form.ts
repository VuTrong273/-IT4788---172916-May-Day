import type { Profile, ProfileChanges } from './profile-api';

type ProfileTextField =
  | 'career'
  | 'ethnic'
  | 'hamlet_address'
  | 'commune_address'
  | 'city_address'
  | 'work_place'
  | 'health_insurance_number'
  | 'health_insurance_validate'
  | 'next_of_kin_name'
  | 'next_of_kin_phone';

export type ProfileDraft = Record<ProfileTextField, string> & {
  full_name: string;
  gender: 'male' | 'female' | 'other' | null;
  year_of_birth: string;
};

const textFields: readonly ProfileTextField[] = [
  'career',
  'ethnic',
  'hamlet_address',
  'commune_address',
  'city_address',
  'work_place',
  'health_insurance_number',
  'health_insurance_validate',
  'next_of_kin_name',
  'next_of_kin_phone',
];

export function createProfileDraft(profile: Profile): ProfileDraft {
  return {
    full_name: profile.full_name,
    gender: profile.gender ?? null,
    year_of_birth: profile.year_of_birth?.toString() ?? '',
    career: profile.career ?? '',
    ethnic: profile.ethnic ?? '',
    hamlet_address: profile.hamlet_address ?? '',
    commune_address: profile.commune_address ?? '',
    city_address: profile.city_address ?? '',
    work_place: profile.work_place ?? '',
    health_insurance_number: profile.health_insurance_number ?? '',
    health_insurance_validate: profile.health_insurance_validate ?? '',
    next_of_kin_name: profile.next_of_kin_name ?? '',
    next_of_kin_phone: profile.next_of_kin_phone ?? '',
  };
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateProfileDraft(draft: ProfileDraft): string | null {
  if (!draft.full_name.trim()) return 'Họ tên không được để trống.';
  if (draft.year_of_birth && !/^\d+$/.test(draft.year_of_birth.trim())) {
    return 'Năm sinh phải là số nguyên.';
  }
  if (
    draft.year_of_birth.trim() &&
    !Number.isSafeInteger(Number(draft.year_of_birth.trim()))
  ) {
    return 'Năm sinh phải là số nguyên hợp lệ.';
  }
  if (
    draft.health_insurance_validate &&
    !isValidDate(draft.health_insurance_validate.trim())
  ) {
    return 'Hạn thẻ bảo hiểm phải theo định dạng YYYY-MM-DD.';
  }
  return null;
}

export function getProfileChanges(
  profile: Profile,
  draft: ProfileDraft,
): ProfileChanges {
  const changes: ProfileChanges = {};
  const fullName = draft.full_name.trim();
  if (fullName !== profile.full_name) changes.full_name = fullName;

  if (draft.gender && draft.gender !== (profile.gender ?? null)) {
    changes.gender = draft.gender;
  }

  const year = draft.year_of_birth.trim() ? Number(draft.year_of_birth.trim()) : null;
  if (year !== (profile.year_of_birth ?? null)) changes.year_of_birth = year;

  for (const field of textFields) {
    const value = draft[field].trim() || null;
    if (value !== (profile[field] ?? null)) changes[field] = value;
  }
  return changes;
}
