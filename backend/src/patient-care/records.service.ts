import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { array, id, object, text } from '../common/validation.js';
import { PatientAccessService } from './access.service.js';

@Injectable()
export class PatientRecordsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: PatientAccessService,
  ) {}

  async classificationQuestions() {
    // Selection is explicit: no unconfigured clinical diagnostic rules are inferred.
    return this.db.transaction(async (tx) => {
      const templates = (
        await tx.query(
          'SELECT code_template, name FROM templates WHERE is_active=1 ORDER BY name, code_template',
        )
      ).rows;
      return success(
        templates.length
          ? [
              {
                question_id: 'TEMPLATE_SELECTION',
                question_text:
                  'Chọn mẫu phiếu khám theo hướng dẫn của cơ sở y tế',
                type_question: 'radio',
                options: templates.map((t, i) => ({
                  id: i + 1,
                  option_text: t.name,
                  option_value: t.code_template,
                })),
              },
            ]
          : [],
      );
    });
  }
  async classify(body: unknown) {
    const input = object(body);
    const answers = array(input.answers).map(object);
    if (answers.length !== 1 || answers[0].question_id !== 'TEMPLATE_SELECTION')
      fail('4006', 'Classification answers are incomplete');
    const code = text(answers[0].option_value, 225);
    return this.db.transaction(async (tx) => {
      const row = (
        await tx.query(
          'SELECT code_template AS template_id, name AS template_name FROM templates WHERE code_template=$1 AND is_active=1',
          [code],
        )
      ).rows[0];
      if (!row) fail('4101', 'Template not found', 404);
      return success(row);
    });
  }
  async create(user: AuthenticatedUser, body: unknown) {
    const input = object(body);
    const template = text(input.template_id, 225);
    return this.db.transaction(async (tx) => {
      const role = await this.access.role(tx, user);
      if (!['doctor', 'patient'].includes(role ?? ''))
        fail('3101', 'Permission denied', 403);
      const patientId = role === 'patient' ? user.userId : id(input.patient_id);
      if (
        role === 'patient' &&
        input.patient_id !== undefined &&
        id(input.patient_id) !== user.userId
      )
        fail('3106', 'Cannot create a record for another patient', 403);
      if (
        !(
          await tx.query(
            'SELECT 1 FROM users u JOIN patients p USING(user_id) WHERE u.user_id=$1 AND u.is_active=1 FOR UPDATE OF u',
            [patientId],
          )
        ).rowCount
      )
        fail('3007', 'Patient not found', 404);
      if (
        !(
          await tx.query(
            'SELECT 1 FROM templates WHERE code_template=$1 AND is_active=1 FOR SHARE',
            [template],
          )
        ).rowCount
      )
        fail('4101', 'Template not found', 404);
      const row = (
        await tx.query(
          'INSERT INTO medical_records(patient_id,created_by,template_id) VALUES($1,$2,$3) RETURNING *',
          [patientId, user.userId, template],
        )
      ).rows[0];
      await tx.query(
        'UPDATE patients SET first_visit=COALESCE(first_visit, now()) WHERE user_id=$1',
        [patientId],
      );
      if (input.answers !== undefined)
        await this.writeAnswers(tx, user, row, role!, input.answers);
      return success(row, true);
    });
  }
  async history(user: AuthenticatedUser, patient: unknown) {
    return this.db.transaction(async (tx) => {
      const { patientId, role } = await this.access.patient(tx, user, patient);
      const rows = await tx.query(
        `SELECT medical_record_id,status,instructions,created_at FROM medical_records WHERE patient_id=$1 ${role === 'doctor' ? 'AND assigned_doctor_id=$2' : ''} ORDER BY created_at DESC,medical_record_id DESC`,
        role === 'doctor' ? [patientId, user.userId] : [patientId],
      );
      return success(rows.rows);
    });
  }
  async answers(user: AuthenticatedUser, recordId: unknown, body?: unknown) {
    return this.db.transaction(async (tx) => {
      const { row, role } = await this.access.record(
        tx,
        user,
        recordId,
        body !== undefined,
      );
      if (body !== undefined)
        return success({
          count: await this.writeAnswers(
            tx,
            user,
            row,
            role!,
            object(body).answers,
          ),
        });
      return success(
        (
          await tx.query(
            'SELECT answer_id AS id,* FROM answers WHERE medical_record_id=$1 ORDER BY answer_id',
            [row.medical_record_id],
          )
        ).rows,
      );
    });
  }
  private async writeAnswers(
    tx: pg.PoolClient,
    user: AuthenticatedUser,
    record: Record<string, unknown>,
    role: string,
    value: unknown,
  ) {
    if (!Array.isArray(value) || !value.length)
      fail('4007', 'Answers list must not be empty');
    const entries = array(value).map(object);
    const seen = new Set<string>();
    for (const answer of entries) {
      const questionId = text(answer.question_id, 50);
      if (seen.has(questionId)) fail('2003', 'Duplicate question');
      seen.add(questionId);
      const question = (
        await tx.query(
          'SELECT q.*,s.template_id,s.filled_by FROM questions q JOIN template_sections s USING(section_id) WHERE q.question_id=$1',
          [questionId],
        )
      ).rows[0];
      if (!question || question.template_id !== record.template_id)
        fail('4008', "Question does not belong to the record's template");
      if (
        !['doctor', 'patient'].includes(role) ||
        ![role, 'patdoc'].includes(question.filled_by)
      )
        fail('3101', 'Section is not writable by this role', 403);
      const option =
        answer.question_option_id === null ||
        answer.question_option_id === undefined
          ? null
          : id(answer.question_option_id);
      if (
        option &&
        !(
          await tx.query(
            'SELECT 1 FROM question_options WHERE option_id=$1 AND question_id=$2',
            [option, questionId],
          )
        ).rowCount
      )
        fail('2003', 'Option does not belong to question');
      const answerText =
        answer.answer_text === null || answer.answer_text === undefined
          ? null
          : text(answer.answer_text);
      const answerValue = answer.answer_value ?? null;
      if (option === null && answerText === null && answerValue === null)
        fail('4007', 'Answer has no value');
      if (
        ['checkbox', 'select', 'radio'].includes(question.type_question) &&
        answerValue !== null
      ) {
        const values = Array.isArray(answerValue) ? answerValue : [answerValue];
        if (!values.length || values.some((v) => typeof v !== 'string'))
          fail('2003', 'Invalid choice values');
        const choices = await tx.query(
          'SELECT option_value FROM question_options WHERE question_id=$1',
          [questionId],
        );
        if (values.some((v) => !choices.rows.some((c) => c.option_value === v)))
          fail('2003', 'Invalid choice value');
      }
      await tx.query(
        `INSERT INTO answers(medical_record_id,question_id,question_option_id,answer_text,answer_value,answered_by) VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(medical_record_id,question_id) DO UPDATE SET question_option_id=EXCLUDED.question_option_id, answer_text=EXCLUDED.answer_text,answer_value=EXCLUDED.answer_value,answered_by=EXCLUDED.answered_by`,
        [
          record.medical_record_id,
          questionId,
          option,
          answerText,
          answerValue === null ? null : JSON.stringify(answerValue),
          user.userId,
        ],
      );
    }
    return entries.length;
  }
  async complete(user: AuthenticatedUser, recordId: unknown, body: unknown) {
    const input = object(body);
    if (input.status !== 'completed')
      fail('4009', 'Invalid medical record status');
    const instructions =
      input.instructions === undefined ? null : text(input.instructions);
    return this.db.transaction(async (tx) => {
      const { row, role } = await this.access.record(tx, user, recordId, true);
      if (role !== 'doctor') fail('3103', 'Doctor role required', 403);
      if (row.status !== 'in_progress')
        fail('4004', 'Record must be in progress', 409);
      return success(
        (
          await tx.query(
            "UPDATE medical_records SET status='completed',completed_at=clock_timestamp(),instructions=$2 WHERE medical_record_id=$1 RETURNING *",
            [row.medical_record_id, instructions],
          )
        ).rows[0],
      );
    });
  }
  async remove(user: AuthenticatedUser, recordId: unknown) {
    return this.db.transaction(async (tx) => {
      const { row, role } = await this.access.record(tx, user, recordId);
      if (role !== 'admin') fail('3102', 'Admin role required', 403);
      await tx.query('DELETE FROM medical_records WHERE medical_record_id=$1', [
        row.medical_record_id,
      ]);
      return success({});
    });
  }
}
