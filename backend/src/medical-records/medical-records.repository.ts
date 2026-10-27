import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

export type RecordStatus = 'pending' | 'in_progress' | 'completed';

export interface MedicalRecord {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  created_by: number | null;
  template_id: string;
  status: RecordStatus;
  instructions: string | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type RecordListItem = Pick<
  MedicalRecord,
  | 'medical_record_id'
  | 'patient_id'
  | 'assigned_doctor_id'
  | 'template_id'
  | 'status'
  | 'created_at'
>;

export type RecordQuestion = {
  question_id: string;
  section_id: number;
  filled_by: 'patient' | 'doctor' | 'patdoc';
  type_question: string;
  is_required: number;
  options: Array<{ id: number; option_value: string }>;
};

export type MedicalRecordAnswer = {
  id: number;
  medical_record_id: number;
  question_id: string;
  question_option_id: number | null;
  answer_text: string | null;
  answer_value: unknown;
  answered_by: number | null;
  created_at: Date;
  updated_at: Date;
};

export type AnswerInput = {
  question_id: string;
  question_option_id: number | null;
  answer_text: string | null;
  answer_value: unknown;
};

@Injectable()
export class MedicalRecordsRepository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });

  async roleName(roleId: number): Promise<string | null> {
    const result = await this.pool.query<{ name: string }>(
      'SELECT name FROM roles WHERE role_id = $1',
      [roleId],
    );
    return result.rows[0]?.name ?? null;
  }

  async list(filters: {
    status?: RecordStatus;
    patientId?: number;
    doctorId?: number;
    page: number;
    limit: number;
  }) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filters.status) {
      values.push(filters.status);
      conditions.push(`r.status = $${values.length}`);
    }
    if (filters.patientId) {
      values.push(filters.patientId);
      conditions.push(`r.patient_id = $${values.length}`);
    }
    if (filters.doctorId) {
      values.push(filters.doctorId);
      conditions.push(
        `(r.status = 'pending' AND r.assigned_doctor_id IS NULL OR r.assigned_doctor_id = $${values.length})`,
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = await this.pool.query<{ count: string }>(
      `SELECT count(*) FROM medical_records r ${where}`,
      values,
    );
    const rows = await this.pool.query<RecordListItem>(
      `SELECT r.medical_record_id, r.patient_id, r.assigned_doctor_id, r.template_id, r.status, r.created_at
       FROM medical_records r ${where}
       ORDER BY r.created_at DESC, r.medical_record_id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.limit, (filters.page - 1) * filters.limit],
    );
    return {
      data: rows.rows,
      total: Number(total.rows[0].count),
      page: filters.page,
      limit: filters.limit,
    };
  }

  async findById(id: number): Promise<MedicalRecord | null> {
    const result = await this.pool.query<MedicalRecord>(
      `SELECT medical_record_id, patient_id, assigned_doctor_id, created_by, template_id,
              status, instructions, completed_at, created_at, updated_at
       FROM medical_records WHERE medical_record_id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async patientName(patientId: number): Promise<string | null> {
    const result = await this.pool.query<{ full_name: string }>(
      'SELECT full_name FROM users WHERE user_id = $1',
      [patientId],
    );
    return result.rows[0]?.full_name ?? null;
  }

  async activeTemplateExists(code: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM templates WHERE code_template = $1 AND is_active = 1',
      [code],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async patientExists(userId: number): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM patients WHERE user_id = $1',
      [userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async create(
    patientId: number,
    creatorId: number,
    templateId: string,
    answers: AnswerInput[] = [],
  ): Promise<MedicalRecord> {
    if (answers.length === 0) {
      const result = await this.pool.query<MedicalRecord>(
        `INSERT INTO medical_records (patient_id, created_by, template_id, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING medical_record_id, patient_id, assigned_doctor_id, created_by, template_id,
                   status, instructions, completed_at, created_at, updated_at`,
        [patientId, creatorId, templateId],
      );
      return result.rows[0];
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<MedicalRecord>(
        `INSERT INTO medical_records (patient_id, created_by, template_id, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING medical_record_id, patient_id, assigned_doctor_id, created_by, template_id,
                   status, instructions, completed_at, created_at, updated_at`,
        [patientId, creatorId, templateId],
      );
      const record = result.rows[0];
      for (const answer of answers) {
        await client.query(
          `INSERT INTO answers
             (medical_record_id, question_id, question_option_id, answer_text, answer_value, answered_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
          [
            record.medical_record_id,
            answer.question_id,
            answer.question_option_id,
            answer.answer_text,
            answer.answer_value === null ? null : JSON.stringify(answer.answer_value),
            creatorId,
          ],
        );
      }
      await client.query('COMMIT');
      return record;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async questionsForTemplate(templateId: string): Promise<RecordQuestion[]> {
    const questions = await this.pool.query<Omit<RecordQuestion, 'options'>>(
      `SELECT q.question_id, s.section_id, s.filled_by, q.type_question, q.is_required
       FROM questions q
       JOIN template_sections s ON s.section_id = q.section_id
       WHERE s.template_id = $1`,
      [templateId],
    );
    const options = await this.pool.query<{
      id: number;
      question_id: string;
      option_value: string;
    }>(
      `SELECT o.option_id AS id, o.question_id, o.option_value
       FROM question_options o
       JOIN questions q ON q.question_id = o.question_id
       JOIN template_sections s ON s.section_id = q.section_id
       WHERE s.template_id = $1`,
      [templateId],
    );
    const optionsByQuestion = new Map<string, RecordQuestion['options']>();
    for (const option of options.rows) {
      const current = optionsByQuestion.get(option.question_id) ?? [];
      current.push({ id: option.id, option_value: option.option_value });
      optionsByQuestion.set(option.question_id, current);
    }
    return questions.rows.map((question) => ({
      ...question,
      options: optionsByQuestion.get(question.question_id) ?? [],
    }));
  }

  async answers(recordId: number): Promise<MedicalRecordAnswer[]> {
    const result = await this.pool.query<MedicalRecordAnswer>(
      `SELECT answer_id AS id, medical_record_id, question_id, question_option_id,
              answer_text, answer_value, answered_by, created_at, updated_at
       FROM answers WHERE medical_record_id = $1 ORDER BY created_at, answer_id`,
      [recordId],
    );
    return result.rows;
  }

  async upsertAnswers(
    recordId: number,
    userId: number,
    answers: AnswerInput[],
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const recordResult = await client.query<{ status: RecordStatus }>(
        'SELECT status FROM medical_records WHERE medical_record_id = $1 FOR UPDATE',
        [recordId],
      );
      if (!recordResult.rowCount) {
        await client.query('ROLLBACK');
        return { missingRecord: true as const };
      }
      if (recordResult.rows[0].status === 'completed') {
        await client.query('ROLLBACK');
        return { completed: true as const };
      }
      for (const answer of answers) {
        await client.query(
          `INSERT INTO answers
             (medical_record_id, question_id, question_option_id, answer_text, answer_value, answered_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)
           ON CONFLICT (medical_record_id, question_id) DO UPDATE
           SET question_option_id = EXCLUDED.question_option_id,
               answer_text = EXCLUDED.answer_text,
               answer_value = EXCLUDED.answer_value,
               answered_by = EXCLUDED.answered_by,
               updated_at = clock_timestamp()`,
          [
            recordId,
            answer.question_id,
            answer.question_option_id,
            answer.answer_text,
            answer.answer_value === null
              ? null
              : JSON.stringify(answer.answer_value),
            userId,
          ],
        );
      }
      await client.query('COMMIT');
      return { count: answers.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(
    id: number,
    doctorId: number,
    instructions: string | null,
  ): Promise<MedicalRecord | null> {
    const result = await this.pool.query<MedicalRecord>(
      `UPDATE medical_records
       SET status = 'completed', instructions = $3, completed_at = clock_timestamp(),
           updated_at = clock_timestamp()
       WHERE medical_record_id = $1 AND assigned_doctor_id = $2 AND status = 'in_progress'
       RETURNING medical_record_id, patient_id, assigned_doctor_id, created_by, template_id,
                 status, instructions, completed_at, created_at, updated_at`,
      [id, doctorId, instructions],
    );
    return result.rows[0] ?? null;
  }

  async history(patientId: number, doctorId?: number) {
    const values: unknown[] = [patientId];
    const doctorFilter =
      doctorId === undefined
        ? ''
        : `AND (assigned_doctor_id = $2 OR status = 'pending' AND assigned_doctor_id IS NULL)`;
    if (doctorId !== undefined) values.push(doctorId);
    const result = await this.pool.query<
      Pick<
        MedicalRecord,
        'medical_record_id' | 'status' | 'instructions' | 'created_at'
      >
    >(
      `SELECT medical_record_id, status, instructions, created_at FROM medical_records
       WHERE patient_id = $1 ${doctorFilter}
       ORDER BY created_at DESC, medical_record_id DESC`,
      values,
    );
    return result.rows;
  }

  async accept(
    id: number,
    doctorId: number,
  ): Promise<Pick<
    MedicalRecord,
    'medical_record_id' | 'assigned_doctor_id' | 'status'
  > | null> {
    const result = await this.pool.query<
      Pick<MedicalRecord, 'medical_record_id' | 'assigned_doctor_id' | 'status'>
    >(
      `UPDATE medical_records SET status = 'in_progress', assigned_doctor_id = $2,
              updated_at = clock_timestamp()
       WHERE medical_record_id = $1 AND status = 'pending' AND assigned_doctor_id IS NULL
       RETURNING medical_record_id, assigned_doctor_id, status`,
      [id, doctorId],
    );
    return result.rows[0] ?? null;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
