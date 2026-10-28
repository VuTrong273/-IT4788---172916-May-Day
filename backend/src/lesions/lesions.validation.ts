import { HttpException } from '@nestjs/common';

export function fail(code: string, message: string, status = 400): never {
  throw new HttpException({ code, message, data: {} }, status);
}
export function id(value: unknown): number {
  if (
    !['string', 'number'].includes(typeof value) ||
    !/^[1-9]\d*$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value))
  )
    fail('2003', 'Invalid ID');
  return Number(value);
}
export function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('2007', 'Invalid body');
  return value as Record<string, unknown>;
}
export function text(
  value: unknown,
  max: number,
  required = false,
): string | null {
  if (value === undefined || value === null) {
    if (required) fail('2001', 'Missing required field');
    return null;
  }
  if (typeof value !== 'string') fail('2002', 'Invalid field type');
  const result = value.trim();
  if (result.length > max || (required && !result))
    fail('2007', 'Invalid field length');
  return result || null;
}
export function timestamp(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    Number.isNaN(Date.parse(value))
  )
    fail('2006', 'Invalid date');
  const datePart = value.slice(0, 10);
  if (new Date(`${datePart}T00:00:00Z`).toISOString().slice(0, 10) !== datePart)
    fail('2006', 'Invalid date');
  return value;
}
export function score(value: unknown, max = 10): number | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  )
    fail('7007', 'Invalid symptom score');
  return value;
}
export type RecordAccess = {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  status: string;
};
export function authorize(
  record: RecordAccess | undefined,
  userId: number,
  role: string | null,
  write: boolean,
) {
  if (!record) fail('4001', 'Medical record not found', 404);
  if (!['admin', 'doctor', 'patient'].includes(role ?? ''))
    fail('3101', 'Permission denied', 403);
  if (role === 'patient' && record.patient_id !== userId)
    fail('3106', 'Patient does not own this record', 403);
  if (role === 'doctor' && record.assigned_doctor_id !== userId)
    fail('3105', 'Doctor is not assigned to this record', 403);
  if (write && record.status === 'completed')
    fail('4003', 'Medical record is completed', 409);
  return record;
}

export type ImageUpload = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};
export function imageType(file: ImageUpload | undefined): string {
  if (!file || !file.buffer.length) fail('6001', 'Image file is required');
  if (file.buffer.length > 5 * 1024 * 1024)
    fail('6003', 'Image exceeds 5 MB', 413);
  const bytes = file.buffer;
  let type: string | undefined;
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    type = 'image/jpeg';
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    type = 'image/png';
  if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    type = 'image/webp';
  if (!type || file.mimetype !== type) fail('6002', 'Unsupported image format');
  return type;
}
