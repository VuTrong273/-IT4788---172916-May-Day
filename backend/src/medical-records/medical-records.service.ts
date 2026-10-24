import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { MedicalRecordsRepository, type RecordStatus } from './medical-records.repository.js';

function fail(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function positiveInteger(value: unknown, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  return number;
}

@Injectable()
export class MedicalRecordsService {
  constructor(private readonly records: MedicalRecordsRepository) {}

  private async role(user: AuthenticatedUser) {
    try {
      return await this.records.roleName(user.roleId);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async list(user: AuthenticatedUser, query: Record<string, unknown>) {
    const role = await this.role(user);
    if (role !== 'doctor' && role !== 'admin') return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    const page = positiveInteger(query.page, 1);
    const limit = positiveInteger(query.limit, 20);
    if (limit > 100) return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    const status = query.status;
    if (status !== undefined && (typeof status !== 'string' || !['pending', 'in_progress', 'completed'].includes(status))) {
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    const patientId = query.patient_id === undefined ? undefined : positiveInteger(query.patient_id);
    try {
      const result = await this.records.list({
        page, limit, status: status as RecordStatus | undefined, patientId,
        doctorId: role === 'doctor' ? user.userId : undefined,
      });
      return { code: '1000', message: 'OK', ...result };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private async readableRecord(user: AuthenticatedUser, rawId: string) {
    const id = positiveInteger(rawId);
    const role = await this.role(user);
    let record;
    try {
      record = await this.records.findById(id);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!record) return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
    if (role === 'patient' && record.patient_id !== user.userId) {
      return fail('3106', 'Patient does not own this medical record', HttpStatus.FORBIDDEN);
    }
    if (role === 'doctor' && record.assigned_doctor_id !== user.userId &&
      !(record.status === 'pending' && record.assigned_doctor_id === null)) {
      return fail('3105', 'Doctor is not assigned to this medical record', HttpStatus.FORBIDDEN);
    }
    if (!['admin', 'doctor', 'patient'].includes(role ?? '')) {
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    }
    return record;
  }

  async get(user: AuthenticatedUser, id: string) {
    return { code: '1000', message: 'OK', data: await this.readableRecord(user, id) };
  }

  async summary(user: AuthenticatedUser, id: string) {
    const record = await this.readableRecord(user, id);
    let patientName;
    try {
      patientName = await this.records.patientName(record.patient_id);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { code: '1000', message: 'OK', data: {
      medical_record_id: record.medical_record_id,
      status: record.status,
      patient_name: patientName,
      created_at: record.created_at,
    } };
  }

  async accept(user: AuthenticatedUser, rawId: string) {
    const id = positiveInteger(rawId);
    if (await this.role(user) !== 'doctor') return fail('3103', 'Doctor role required', HttpStatus.FORBIDDEN);
    try {
      const accepted = await this.records.accept(id, user.userId);
      if (accepted) return { code: '1000', message: 'OK', data: accepted };
      const existing = await this.records.findById(id);
      if (!existing) return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
      if (existing.assigned_doctor_id !== null && existing.assigned_doctor_id !== user.userId) {
        return fail('4005', 'Medical record already accepted by another doctor', HttpStatus.CONFLICT);
      }
      return fail('4004', 'Medical record is not in pending status', HttpStatus.CONFLICT);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
