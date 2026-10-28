import { HttpException } from '@nestjs/common';

export function patientError(
  code: string,
  message: string,
  status = 400,
): never {
  throw new HttpException({ code, message, data: {} }, status);
}

export const patientTextLimits = {
  career: 150,
  ethnic: 50,
  hamlet_address: 150,
  commune_address: 150,
  city_address: 150,
  work_place: 255,
  health_insurance_number: 30,
  next_of_kin_name: 150,
  next_of_kin_phone: 20,
} as const;

export type PatientInput = {
  fullName: string;
  phone: string;
  password: string;
  gender: string | null;
  yearOfBirth: number | null;
  details: Record<string, string | null>;
};

export function parsePatient(body: unknown): PatientInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return patientError('2007', 'Request body is invalid');
  }
  const data = body as Record<string, unknown>;
  for (const key of ['full_name', 'phone', 'password']) {
    if (data[key] === undefined || data[key] === '')
      patientError('2001', 'Missing required parameter');
    if (typeof data[key] !== 'string')
      patientError('2002', 'Invalid parameter type');
  }
  const fullName = (data.full_name as string).trim();
  const phone = data.phone as string;
  const password = data.password as string;
  if (!/^(03|05|07|08|09)[0-9]{8}$/.test(phone))
    patientError('2004', 'Invalid phone number format');
  if (
    !fullName ||
    fullName.length > 150 ||
    password.length < 6 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    patientError('2007', 'Request body is invalid');
  }
  if (data.gender !== undefined && typeof data.gender !== 'string')
    patientError('2002', 'Invalid parameter type');
  if (
    data.gender !== undefined &&
    !['male', 'female', 'other'].includes(data.gender as string)
  )
    patientError('2007', 'Invalid gender');
  if (
    data.year_of_birth !== undefined &&
    typeof data.year_of_birth !== 'number'
  )
    patientError('2002', 'Invalid parameter type');
  const year = data.year_of_birth as number | undefined;
  if (
    year !== undefined &&
    (!Number.isInteger(year) || year < 1900 || year > 2100)
  )
    patientError('2007', 'Invalid year of birth');
  const details: Record<string, string | null> = {};
  for (const [key, limit] of Object.entries(patientTextLimits)) {
    const value = data[key];
    if (value !== undefined && value !== null && typeof value !== 'string')
      patientError('2002', 'Invalid parameter type');
    if (typeof value === 'string' && value.length > limit)
      patientError('2007', 'Field is too long');
    details[key] = typeof value === 'string' ? value.trim() || null : null;
  }
  const expiry = data.health_insurance_validate;
  if (expiry !== undefined && expiry !== null) {
    if (typeof expiry !== 'string')
      patientError('2002', 'Invalid parameter type');
    const date = new Date(`${expiry}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== expiry
    )
      patientError('2007', 'Invalid insurance expiry date');
  }
  details.health_insurance_validate =
    (expiry as string | null | undefined) ?? null;
  return {
    fullName,
    phone,
    password,
    gender: (data.gender as string | undefined) ?? null,
    yearOfBirth: year ?? null,
    details,
  };
}
