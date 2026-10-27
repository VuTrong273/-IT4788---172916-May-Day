import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

export interface Uas7Score {
  patient_id: string;
  medical_record_id: string;
  score_date: string;
  iss7: string;
  hss7: string;
  daily_score: string;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

const scoreColumns = `patient_id::text, medical_record_id::text,
  to_char(score_date, 'YYYY-MM-DD') AS score_date, iss7::text, hss7::text,
  daily_score::text, note, created_at, updated_at`;

@Injectable()
export class Uas7Repository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });

  async roleName(roleId: number): Promise<string | null> {
    const result = await this.pool.query<{ name: string }>(
      'SELECT name FROM roles WHERE role_id = $1', [roleId],
    );
    return result.rows[0]?.name ?? null;
  }

  async patientExists(patientId: number): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM patients WHERE user_id = $1', [patientId],
    );
    return result.rowCount !== 0;
  }

  async doctorAssigned(patientId: number, doctorId: number): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM medical_records WHERE patient_id = $1 AND assigned_doctor_id = $2 LIMIT 1',
      [patientId, doctorId],
    );
    return result.rowCount !== 0;
  }

  async activeRecord(patientId: number): Promise<number | null> {
    const result = await this.pool.query<{ medical_record_id: number }>(
      `SELECT medical_record_id FROM medical_records
       WHERE patient_id = $1 AND status = 'in_progress'
       ORDER BY created_at DESC, medical_record_id DESC LIMIT 1`, [patientId],
    );
    return result.rows[0]?.medical_record_id ?? null;
  }

  async recordForPatient(recordId: number, patientId: number): Promise<'missing' | 'owned' | 'foreign'> {
    const result = await this.pool.query<{ patient_id: number }>(
      'SELECT patient_id FROM medical_records WHERE medical_record_id = $1', [recordId],
    );
    if (!result.rows[0]) return 'missing';
    return result.rows[0].patient_id === patientId ? 'owned' : 'foreign';
  }

  async create(input: {
    patientId: number; recordId: number; date: string;
    iss7: number; hss7: number; note: string | null;
  }): Promise<Uas7Score | null> {
    const result = await this.pool.query<Uas7Score>(
      `INSERT INTO uas7_scores (patient_id, medical_record_id, score_date, iss7, hss7, note)
       SELECT $1, r.medical_record_id, $3::date, $4, $5, $6
       FROM medical_records r
       WHERE r.medical_record_id = $2 AND r.patient_id = $1 AND r.status = 'in_progress'
       RETURNING ${scoreColumns}`,
      [input.patientId, input.recordId, input.date, input.iss7, input.hss7, input.note],
    );
    return result.rows[0] ?? null;
  }

  async history(patientId: number): Promise<Uas7Score[]> {
    const result = await this.pool.query<Uas7Score>(
      `SELECT ${scoreColumns} FROM uas7_scores WHERE patient_id = $1
       ORDER BY score_date DESC, uas7_id DESC`, [patientId],
    );
    return result.rows;
  }

  async week(patientId: number, startDate: string): Promise<{ week_score: string; completed_days: string }> {
    const result = await this.pool.query<{ week_score: string; completed_days: string }>(
      `SELECT COALESCE(SUM(daily_score), 0)::text AS week_score,
              COUNT(*)::text AS completed_days
       FROM uas7_scores WHERE patient_id = $1
         AND score_date >= $2::date AND score_date < ($2::date + 7)`,
      [patientId, startDate],
    );
    return result.rows[0];
  }

  async onModuleDestroy() { await this.pool.end(); }
}
