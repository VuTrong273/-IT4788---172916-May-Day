import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { ClinicalOrdersRepository } from './clinical-orders.repository.js';

type JsonObject = Record<string, unknown>;

function fail(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function objectBody(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  }
  return value as JsonObject;
}

function positiveId(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  return Number(value);
}

function requiredText(value: unknown, maxLength: number): string {
  if (value === undefined || value === null || value === '') {
    return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
  }
  if (typeof value !== 'string') return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
  const text = value.trim();
  if (!text || text.length > maxLength) return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  return text;
}

function optionalText(value: unknown, maxLength = 10000): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
  const text = value.trim();
  if (text.length > maxLength) return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
  return text || null;
}

function requiredItems(
  value: unknown,
  emptyCode: string,
  missingCode: string,
  requiredFields: string[],
): JsonObject[] {
  if (!Array.isArray(value)) return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
  if (value.length === 0) return fail(emptyCode, 'At least one item is required', HttpStatus.BAD_REQUEST);
  if (value.length > 50) return fail('2007', 'Too many items', HttpStatus.BAD_REQUEST);
  return value.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    return item as JsonObject;
  }).map((item) => {
    if (requiredFields.some((field) => item[field] === undefined || item[field] === null || item[field] === '')) {
      return fail(missingCode, 'Item is missing required fields', HttpStatus.BAD_REQUEST);
    }
    return item;
  });
}

@Injectable()
export class ClinicalOrdersService {
  constructor(private readonly orders: ClinicalOrdersRepository) {}

  private async role(user: AuthenticatedUser) {
    try {
      return await this.orders.roleName(user.roleId);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private async record(user: AuthenticatedUser, rawId: unknown, action: 'read' | 'write') {
    const id = positiveId(rawId);
    const role = await this.role(user);
    if (!['doctor', 'patient', 'admin'].includes(role ?? '')) {
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    }
    let record;
    try {
      record = await this.orders.recordAccess(id);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    if (!record) return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
    if (role === 'patient' && record.patient_id !== user.userId) {
      return fail('3106', 'Patient does not own this medical record', HttpStatus.FORBIDDEN);
    }
    if (role === 'doctor' && record.assigned_doctor_id !== user.userId) {
      return fail('3105', 'Doctor is not assigned to this medical record', HttpStatus.FORBIDDEN);
    }
    if (action === 'write') {
      if (role !== 'doctor') return fail('3103', 'Doctor role required', HttpStatus.FORBIDDEN);
      if (record.status !== 'in_progress') {
        return fail('3105', 'Doctor is not assigned to an active medical record', HttpStatus.FORBIDDEN);
      }
    }
    return { id, role, record };
  }

  async createPrescription(user: AuthenticatedUser, body: unknown) {
    const input = objectBody(body);
    if (input.medical_record_id === undefined || input.items === undefined) {
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    }
    const access = await this.record(user, input.medical_record_id, 'write');
    const items = requiredItems(input.items, '8001', '8002', [
      'medicine_name', 'dosage', 'frequency', 'duration',
    ]).map((item) => ({
      medicine_name: requiredText(item.medicine_name, 255),
      dosage: requiredText(item.dosage, 255),
      frequency: requiredText(item.frequency, 255),
      duration: requiredText(item.duration, 255),
      instruction: optionalText(item.instruction),
    }));
    try {
      const data = await this.orders.createPrescription({
        recordId: access.id,
        doctorId: user.userId,
        note: optionalText(input.note),
        items,
      });
      return { code: '1001', message: 'Created successfully', data: this.formatPrescription(data) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        return fail('8003', 'Prescription already exists for this medical record', HttpStatus.CONFLICT);
      }
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async getPrescription(user: AuthenticatedUser, rawId: string) {
    const access = await this.record(user, rawId, 'read');
    try {
      const prescription = await this.orders.getPrescription(access.id);
      if (!prescription) return fail('2008', 'Prescription not found', HttpStatus.NOT_FOUND);
      return { code: '1000', message: 'OK', data: this.formatPrescription(prescription) };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async createLabRequest(user: AuthenticatedUser, body: unknown) {
    const input = objectBody(body);
    if (input.medical_record_id === undefined || input.items === undefined) {
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    }
    const access = await this.record(user, input.medical_record_id, 'write');
    const items = requiredItems(input.items, '8101', '8102', ['test_name']).map((item) => ({
      test_name: requiredText(item.test_name, 255),
      description: optionalText(item.description),
    }));
    try {
      const data = await this.orders.createLabRequest({
        recordId: access.id,
        doctorId: user.userId,
        note: optionalText(input.note),
        items,
      });
      return { code: '1001', message: 'Created successfully', data: this.formatLabRequest(data) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async listLabResults(user: AuthenticatedUser, rawId: string) {
    const access = await this.record(user, rawId, 'read');
    try {
      const data = await this.orders.listLabRequests(access.id);
      return { code: '1000', message: 'OK', data: data.map((request) => this.formatLabRequest(request)) };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async enterLabResults(user: AuthenticatedUser, body: unknown) {
    const input = objectBody(body);
    if (input.lab_request_id === undefined || input.results === undefined) {
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    }
    const requestId = positiveId(input.lab_request_id);
    const results = requiredItems(input.results, '2007', '2007', [
      'lab_request_item_id', 'result_value',
    ]).map((result) => ({
      itemId: positiveId(result.lab_request_item_id),
      resultValue: requiredText(result.result_value, 10000),
      resultNote: optionalText(result.result_note),
    }));
    if (new Set(results.map((result) => result.itemId)).size !== results.length) {
      return fail('2003', 'Duplicate lab request item', HttpStatus.BAD_REQUEST);
    }
    const role = await this.role(user);
    if (role !== 'doctor') return fail('3103', 'Doctor role required', HttpStatus.FORBIDDEN);
    try {
      const recordId = await this.orders.labRequestRecordId(requestId);
      if (recordId === null) return fail('8103', 'Lab request not found', HttpStatus.NOT_FOUND);
      const access = await this.record(user, String(recordId), 'write');
      const data = await this.orders.enterLabResults({ requestId, doctorId: user.userId, results });
      if (!data) return fail('8103', 'Lab request not found', HttpStatus.NOT_FOUND);
      if ('invalidItem' in data) return fail('2003', 'Lab item does not belong to this request', HttpStatus.BAD_REQUEST);
      if (access.record.status !== 'in_progress') {
        return fail('3105', 'Doctor is not assigned to an active medical record', HttpStatus.FORBIDDEN);
      }
      return { code: '1001', message: 'Created successfully', data: this.formatLabRequest(data) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private formatPrescription(value: {
    prescription_id: number;
    medical_record_id: number;
    created_by: number | null;
    note: string | null;
    items: Array<{
      prescription_item_id: number;
      medicine_name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instruction: string | null;
    }>;
    created_at: Date;
  }) {
    return {
      prescription_id: String(value.prescription_id),
      medical_record_id: String(value.medical_record_id),
      created_by: value.created_by === null ? null : String(value.created_by),
      note: value.note,
      items: value.items.map((item) => ({
        prescription_item_id: String(item.prescription_item_id),
        medicine_name: item.medicine_name,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        instruction: item.instruction,
      })),
      created_at: value.created_at,
    };
  }

  private formatLabRequest(value: {
    lab_request_id: number;
    medical_record_id?: number;
    requested_by: number | null;
    status: 'pending' | 'in_progress' | 'completed';
    note: string | null;
    items: Array<{
      lab_request_item_id: number;
      test_name: string;
      description?: string | null;
      lab_result_id: number | null;
      result_value: string | null;
      concluded_by: number | null;
      result_note: string | null;
    }>;
    created_at: Date;
  }) {
    return {
      id: String(value.lab_request_id),
      ...(value.medical_record_id === undefined ? {} : { medical_record_id: String(value.medical_record_id) }),
      requested_by: value.requested_by === null ? null : String(value.requested_by),
      status: value.status,
      note: value.note,
      items: value.items.map((item) => ({
        id: String(item.lab_request_item_id),
        test_name: item.test_name,
        ...(item.description === undefined ? {} : { description: item.description }),
        result_id: item.lab_result_id === null ? null : String(item.lab_result_id),
        result_value: item.result_value,
        concluded_by: item.concluded_by === null ? null : String(item.concluded_by),
        result_note: item.result_note,
      })),
      created_at: value.created_at,
    };
  }
}
