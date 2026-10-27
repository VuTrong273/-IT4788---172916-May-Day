import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { Uas7Repository } from './uas7.repository.js';

function fail(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function integer(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!/^[0-9]+$/.test(String(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function date(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function defaultStartDate(): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const start = new Date(`${today}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 6);
  return start.toISOString().slice(0, 10);
}

function severity(score: number): string {
  if (score === 0) return 'Không hoạt động';
  if (score <= 6) return 'Nhẹ';
  if (score <= 15) return 'Vừa';
  if (score <= 27) return 'Nặng';
  return 'Rất nặng';
}

@Injectable()
export class Uas7Service {
  constructor(private readonly scores: Uas7Repository) {}

  private async role(user: AuthenticatedUser): Promise<string | null> {
    try { return await this.scores.roleName(user.roleId); }
    catch { return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE); }
  }

  private async readablePatient(user: AuthenticatedUser, rawId: string): Promise<number> {
    const patientId = integer(rawId);
    if (!patientId || patientId < 1)
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    const role = await this.role(user);
    if (role === 'patient' && patientId !== user.userId)
      return fail('3106', 'Patient does not own this data', HttpStatus.FORBIDDEN);
    if (!['admin', 'doctor', 'patient'].includes(role ?? ''))
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    try {
      if (!(await this.scores.patientExists(patientId)))
        return fail('3007', 'Patient not found', HttpStatus.NOT_FOUND);
      if (role === 'doctor' && !(await this.scores.doctorAssigned(patientId, user.userId)))
        return fail('3105', 'Doctor is not assigned to this patient', HttpStatus.FORBIDDEN);
      return patientId;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async eligibility(user: AuthenticatedUser) {
    if ((await this.role(user)) !== 'patient')
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    try {
      const recordId = await this.scores.activeRecord(user.userId);
      return { code: '1000', message: 'OK', data: recordId
        ? { eligible: 'true', medical_record_id: String(recordId) }
        : { eligible: 'false' } };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async create(user: AuthenticatedUser, body: unknown) {
    if ((await this.role(user)) !== 'patient')
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    if (typeof body !== 'object' || body === null || Array.isArray(body))
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    const input = body as Record<string, unknown>;
    if (input.score_date === undefined || input.score_date === null || input.score_date === '')
      return fail('5005', 'Score date is required', HttpStatus.BAD_REQUEST);
    if (!date(input.score_date))
      return fail('2006', 'Invalid date format', HttpStatus.BAD_REQUEST);
    if (input.medical_record_id === undefined || input.iss7 === undefined || input.hss7 === undefined)
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    const recordId = integer(input.medical_record_id);
    if (!recordId || recordId < 1)
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    try {
      const ownership = await this.scores.recordForPatient(recordId, user.userId);
      if (ownership === 'missing')
        return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
      if (ownership === 'foreign')
        return fail('3106', 'Patient does not own this medical record', HttpStatus.FORBIDDEN);
      const activeId = await this.scores.activeRecord(user.userId);
      if (activeId !== recordId)
        return fail('5001', 'Patient is not eligible for UAS7 scoring', HttpStatus.CONFLICT);
      const iss7 = integer(input.iss7);
      if (iss7 === null || iss7 < 0 || iss7 > 3)
        return fail('5003', 'ISS7 score must be between 0 and 3', HttpStatus.BAD_REQUEST);
      const hss7 = integer(input.hss7);
      if (hss7 === null || hss7 < 0 || hss7 > 3)
        return fail('5004', 'HSS7 score must be between 0 and 3', HttpStatus.BAD_REQUEST);
      if (input.note !== undefined && input.note !== null && typeof input.note !== 'string')
        return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
      const note = typeof input.note === 'string' ? input.note.trim() : null;
      if (note && note.length > 500)
        return fail('2007', 'Note is too long', HttpStatus.BAD_REQUEST);
      const result = await this.scores.create({ patientId: user.userId, recordId,
        date: input.score_date, iss7, hss7, note: note || null });
      if (!result)
        return fail('5001', 'Patient is not eligible for UAS7 scoring', HttpStatus.CONFLICT);
      return { code: '1001', message: 'Created successfully', data: result };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505')
        return fail('5002', 'UAS7 score for this date already exists', HttpStatus.CONFLICT);
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async history(user: AuthenticatedUser, rawId: string) {
    const patientId = await this.readablePatient(user, rawId);
    try { return { code: '1000', message: 'OK', data: await this.scores.history(patientId) }; }
    catch { return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE); }
  }

  async week(user: AuthenticatedUser, rawId: string, rawStart?: string) {
    if (rawStart !== undefined && !date(rawStart))
      return fail('2006', 'Invalid date format', HttpStatus.BAD_REQUEST);
    const patientId = await this.readablePatient(user, rawId);
    try {
      const result = await this.scores.week(patientId, rawStart ?? defaultStartDate());
      return { code: '1000', message: 'OK', data: {
        patient_id: String(patientId), week_score: result.week_score,
        severity_label: severity(Number(result.week_score)),
        completed_days: result.completed_days,
      } };
    } catch { return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE); }
  }
}
