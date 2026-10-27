import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import {
  MedicalRecordsRepository,
  type AnswerInput,
  type RecordStatus,
} from './medical-records.repository.js';

function fail(code: string, message: string, status: HttpStatus): never {
  throw new HttpException({ code, message, data: {} }, status);
}

function positiveInteger(value: unknown, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
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
    if (role !== 'doctor' && role !== 'admin')
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    const page = positiveInteger(query.page, 1);
    const limit = positiveInteger(query.limit, 20);
    if (limit > 100)
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    const status = query.status;
    if (
      status !== undefined &&
      (typeof status !== 'string' ||
        !['pending', 'in_progress', 'completed'].includes(status))
    ) {
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    const patientId =
      query.patient_id === undefined
        ? undefined
        : positiveInteger(query.patient_id);
    try {
      const result = await this.records.list({
        page,
        limit,
        status: status as RecordStatus | undefined,
        patientId,
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
    if (!record)
      return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
    if (role === 'patient' && record.patient_id !== user.userId) {
      return fail(
        '3106',
        'Patient does not own this medical record',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      role === 'doctor' &&
      record.assigned_doctor_id !== user.userId &&
      !(record.status === 'pending' && record.assigned_doctor_id === null)
    ) {
      return fail(
        '3105',
        'Doctor is not assigned to this medical record',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!['admin', 'doctor', 'patient'].includes(role ?? '')) {
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    }
    return record;
  }

  async get(user: AuthenticatedUser, id: string) {
    return {
      code: '1000',
      message: 'OK',
      data: await this.readableRecord(user, id),
    };
  }

  async create(user: AuthenticatedUser, body: unknown) {
    const role = await this.role(user);
    if (role !== 'patient' && role !== 'doctor')
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    const input = body as Record<string, unknown>;
    if (
      input.template_id === undefined ||
      (role === 'doctor' && input.patient_id === undefined)
    ) {
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    }
    if (
      typeof input.template_id !== 'string' ||
      (role === 'doctor' &&
        (typeof input.patient_id !== 'number' ||
          !Number.isSafeInteger(input.patient_id)))
    ) {
      return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
    }
    if (input.answers !== undefined && !Array.isArray(input.answers)) {
      return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
    }
    const templateId = input.template_id.trim();
    const patientId =
      role === 'patient' ? user.userId : (input.patient_id as number);
    if (!templateId || templateId.length > 225 || patientId < 1) {
      return fail('2003', 'Invalid parameter value', HttpStatus.BAD_REQUEST);
    }
    try {
      if (!(await this.records.activeTemplateExists(templateId))) {
        return fail('4101', 'Template not found', HttpStatus.NOT_FOUND);
      }
      if (!(await this.records.patientExists(patientId))) {
        return fail('2003', 'Invalid patient', HttpStatus.BAD_REQUEST);
      }
      const initialAnswers =
        Array.isArray(input.answers) && input.answers.length > 0
          ? await this.normalizeAnswers(
              templateId,
              role,
              input.answers,
            )
          : [];
      const result = await this.records.create(
        patientId,
        user.userId,
        templateId,
        initialAnswers,
      );
      return { code: '1001', message: 'Created successfully', data: result };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async history(user: AuthenticatedUser, rawPatientId: string) {
    const patientId = positiveInteger(rawPatientId);
    const role = await this.role(user);
    if (role === 'patient' && patientId !== user.userId) {
      return fail(
        '3106',
        'Patient does not own this medical record',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!['patient', 'doctor', 'admin'].includes(role ?? '')) {
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    }
    try {
      const data = await this.records.history(
        patientId,
        role === 'doctor' ? user.userId : undefined,
      );
      return { code: '1000', message: 'OK', data };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async summary(user: AuthenticatedUser, id: string) {
    const record = await this.readableRecord(user, id);
    let patientName;
    try {
      patientName = await this.records.patientName(record.patient_id);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    return {
      code: '1000',
      message: 'OK',
      data: {
        medical_record_id: record.medical_record_id,
        status: record.status,
        patient_name: patientName,
        created_at: record.created_at,
      },
    };
  }

  async answers(user: AuthenticatedUser, rawId: string) {
    const record = await this.readableRecord(user, rawId);
    try {
      const data = await this.records.answers(record.medical_record_id);
      return { code: '1000', message: 'OK', data };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async upsertAnswers(user: AuthenticatedUser, rawId: string, body: unknown) {
    const input = this.objectBody(body);
    if (!Array.isArray(input.answers)) {
      return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
    }
    if (input.answers.length === 0) {
      return fail(
        '4007',
        'At least one answer is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (input.answers.length > 100) {
      return fail('2007', 'Too many answers', HttpStatus.BAD_REQUEST);
    }
    const record = await this.readableRecord(user, rawId);
    const role = await this.role(user);
    if (role !== 'patient' && role !== 'doctor') {
      return fail('3101', 'Permission denied', HttpStatus.FORBIDDEN);
    }
    if (record.status === 'completed') {
      return fail(
        '4003',
        'Completed medical records cannot be changed',
        HttpStatus.CONFLICT,
      );
    }
    if (role === 'doctor' && record.status !== 'in_progress') {
      return fail(
        '3105',
        'Doctor is not assigned to an active medical record',
        HttpStatus.FORBIDDEN,
      );
    }

    const answers = await this.normalizeAnswers(
      record.template_id,
      role,
      input.answers,
    );

    try {
      const result = await this.records.upsertAnswers(
        record.medical_record_id,
        user.userId,
        answers,
      );
      if ('missingRecord' in result)
        return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
      if ('completed' in result) {
        return fail(
          '4003',
          'Completed medical records cannot be changed',
          HttpStatus.CONFLICT,
        );
      }
      return { code: '1000', message: 'OK', data: result };
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private async normalizeAnswers(
    templateId: string,
    role: 'patient' | 'doctor',
    rawAnswers: unknown[],
  ): Promise<AnswerInput[]> {
    if (rawAnswers.length > 100) {
      return fail('2007', 'Too many answers', HttpStatus.BAD_REQUEST);
    }
    let questions;
    try {
      questions = await this.records.questionsForTemplate(templateId);
    } catch {
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const questionMap = new Map(
      questions.map((question) => [question.question_id, question]),
    );
    const answers: AnswerInput[] = [];
    const seen = new Set<string>();
    for (const rawAnswer of rawAnswers) {
      if (
        typeof rawAnswer !== 'object' ||
        rawAnswer === null ||
        Array.isArray(rawAnswer)
      ) {
        return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
      }
      const answer = rawAnswer as Record<string, unknown>;
      if (
        typeof answer.question_id !== 'string' ||
        !answer.question_id.trim()
      ) {
        return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
      }
      const questionId = answer.question_id.trim();
      if (seen.has(questionId)) {
        return fail(
          '2007',
          'Duplicate question answer',
          HttpStatus.BAD_REQUEST,
        );
      }
      seen.add(questionId);
      const question = questionMap.get(questionId);
      if (!question)
        return fail(
          '4008',
          'Question does not belong to this template',
          HttpStatus.BAD_REQUEST,
        );
      if (question.filled_by !== 'patdoc' && question.filled_by !== role) {
        return fail(
          '3101',
          'This section cannot be filled by this role',
          HttpStatus.FORBIDDEN,
        );
      }

      const hasOption =
        answer.question_option_id !== undefined &&
        answer.question_option_id !== null;
      const hasText =
        answer.answer_text !== undefined && answer.answer_text !== null;
      const hasValue =
        answer.answer_value !== undefined && answer.answer_value !== null;
      if (!hasOption && !hasText && !hasValue) {
        return fail(
          '2007',
          'Answer must contain a value',
          HttpStatus.BAD_REQUEST,
        );
      }
      let optionId: number | null = null;
      if (hasOption) {
        if (
          typeof answer.question_option_id !== 'number' ||
          !Number.isSafeInteger(answer.question_option_id) ||
          answer.question_option_id < 1
        ) {
          return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
        }
        optionId = answer.question_option_id;
        if (!question.options.some((option) => option.id === optionId)) {
          return fail(
            '4008',
            'Option does not belong to this question',
            HttpStatus.BAD_REQUEST,
          );
        }
      }
      if (hasText && typeof answer.answer_text !== 'string') {
        return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
      }
      if (
        typeof answer.answer_text === 'string' &&
        answer.answer_text.length > 10000
      ) {
        return fail('2007', 'Answer is too long', HttpStatus.BAD_REQUEST);
      }
      if (hasValue && !this.isJsonValue(answer.answer_value)) {
        return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
      }
      answers.push({
        question_id: questionId,
        question_option_id: optionId,
        answer_text: hasText ? (answer.answer_text as string) : null,
        answer_value: hasValue ? answer.answer_value : null,
      });
    }
    return answers;
  }

  async complete(user: AuthenticatedUser, rawId: string, body: unknown) {
    const input = this.objectBody(body);
    if (input.status === undefined) {
      return fail('2001', 'Missing required parameter', HttpStatus.BAD_REQUEST);
    }
    if (input.status !== 'completed') {
      return fail('4009', 'Status must be completed', HttpStatus.BAD_REQUEST);
    }
    if (
      input.instructions !== undefined &&
      input.instructions !== null &&
      typeof input.instructions !== 'string'
    ) {
      return fail('2002', 'Invalid parameter type', HttpStatus.BAD_REQUEST);
    }
    if (
      typeof input.instructions === 'string' &&
      input.instructions.length > 10000
    ) {
      return fail('2007', 'Instructions are too long', HttpStatus.BAD_REQUEST);
    }
    const id = positiveInteger(rawId);
    if ((await this.role(user)) !== 'doctor') {
      return fail('3103', 'Doctor role required', HttpStatus.FORBIDDEN);
    }
    let record;
    try {
      record = await this.records.complete(
        id,
        user.userId,
        typeof input.instructions === 'string'
          ? input.instructions.trim() || null
          : null,
      );
      if (record) return { code: '1000', message: 'OK', data: record };
      const current = await this.records.findById(id);
      if (!current)
        return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
      if (current.assigned_doctor_id !== user.userId) {
        return fail(
          '3105',
          'Doctor is not assigned to this medical record',
          HttpStatus.FORBIDDEN,
        );
      }
      return fail(
        '4003',
        'Medical record is not in progress',
        HttpStatus.CONFLICT,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  async accept(user: AuthenticatedUser, rawId: string) {
    const id = positiveInteger(rawId);
    if ((await this.role(user)) !== 'doctor')
      return fail('3103', 'Doctor role required', HttpStatus.FORBIDDEN);
    try {
      const accepted = await this.records.accept(id, user.userId);
      if (accepted) return { code: '1000', message: 'OK', data: accepted };
      const existing = await this.records.findById(id);
      if (!existing)
        return fail('4001', 'Medical record not found', HttpStatus.NOT_FOUND);
      if (
        existing.assigned_doctor_id !== null &&
        existing.assigned_doctor_id !== user.userId
      ) {
        return fail(
          '4005',
          'Medical record already accepted by another doctor',
          HttpStatus.CONFLICT,
        );
      }
      return fail(
        '4004',
        'Medical record is not in pending status',
        HttpStatus.CONFLICT,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      return fail('9902', 'Database error', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  private objectBody(body: unknown): Record<string, unknown> {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return fail('2007', 'Request body is invalid', HttpStatus.BAD_REQUEST);
    }
    return body as Record<string, unknown>;
  }

  private isJsonValue(value: unknown): boolean {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    )
      return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value))
      return value.every((item) => this.isJsonValue(item));
    if (typeof value !== 'object') return false;
    return Object.values(value).every((item) => this.isJsonValue(item));
  }
}
