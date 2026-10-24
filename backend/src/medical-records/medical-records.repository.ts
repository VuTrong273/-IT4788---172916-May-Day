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

export type RecordListItem = Pick<MedicalRecord,
  'medical_record_id' | 'patient_id' | 'assigned_doctor_id' | 'template_id' | 'status' | 'created_at'>;

@Injectable()
export class MedicalRecordsRepository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });

  async roleName(roleId: number): Promise<string | null> {
    const result = await this.pool.query<{ name: string }>('SELECT name FROM roles WHERE role_id = $1', [roleId]);
    return result.rows[0]?.name ?? null;
  }

  async list(filters: { status?: RecordStatus; patientId?: number; doctorId?: number; page: number; limit: number }) {
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
      conditions.push(`(r.status = 'pending' AND r.assigned_doctor_id IS NULL OR r.assigned_doctor_id = $${values.length})`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = await this.pool.query<{ count: string }>(`SELECT count(*) FROM medical_records r ${where}`, values);
    const rows = await this.pool.query<RecordListItem>(
      `SELECT r.medical_record_id, r.patient_id, r.assigned_doctor_id, r.template_id, r.status, r.created_at
       FROM medical_records r ${where}
       ORDER BY r.created_at DESC, r.medical_record_id DESC
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, filters.limit, (filters.page - 1) * filters.limit],
    );
    return { data: rows.rows, total: Number(total.rows[0].count), page: filters.page, limit: filters.limit };
  }

  async findById(id: number): Promise<MedicalRecord | null> {
    const result = await this.pool.query<MedicalRecord>(
      `SELECT medical_record_id, patient_id, assigned_doctor_id, created_by, template_id,
              status, instructions, completed_at, created_at, updated_at
       FROM medical_records WHERE medical_record_id = $1`, [id],
    );
    return result.rows[0] ?? null;
  }

  async patientName(patientId: number): Promise<string | null> {
    const result = await this.pool.query<{ full_name: string }>('SELECT full_name FROM users WHERE user_id = $1', [patientId]);
    return result.rows[0]?.full_name ?? null;
  }

  async accept(id: number, doctorId: number): Promise<Pick<MedicalRecord, 'medical_record_id' | 'assigned_doctor_id' | 'status'> | null> {
    const result = await this.pool.query<Pick<MedicalRecord, 'medical_record_id' | 'assigned_doctor_id' | 'status'>>(
      `UPDATE medical_records SET status = 'in_progress', assigned_doctor_id = $2,
              updated_at = clock_timestamp()
       WHERE medical_record_id = $1 AND status = 'pending' AND assigned_doctor_id IS NULL
       RETURNING medical_record_id, assigned_doctor_id, status`, [id, doctorId],
    );
    return result.rows[0] ?? null;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
