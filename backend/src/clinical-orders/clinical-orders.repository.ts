import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

type MedicalRecordAccess = {
  medical_record_id: number;
  patient_id: number;
  assigned_doctor_id: number | null;
  status: 'pending' | 'in_progress' | 'completed';
};

type PrescriptionRow = {
  prescription_id: number;
  medical_record_id: number;
  created_by: number | null;
  note: string | null;
  created_at: Date;
  items: Array<{
    prescription_item_id: number;
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instruction: string | null;
  }>;
};

type LabRequestRow = {
  lab_request_id: number;
  medical_record_id: number;
  requested_by: number | null;
  status: 'pending' | 'in_progress' | 'completed';
  note: string | null;
  created_at: Date;
};

type LabItemRow = {
  lab_request_item_id: number;
  test_name: string;
  description: string | null;
  lab_result_id: number | null;
  result_value: string | null;
  concluded_by: number | null;
  result_note: string | null;
};

@Injectable()
export class ClinicalOrdersRepository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });

  async roleName(roleId: number) {
    const result = await this.pool.query<{ name: string }>('SELECT name FROM roles WHERE role_id = $1', [roleId]);
    return result.rows[0]?.name ?? null;
  }

  async recordAccess(id: number): Promise<MedicalRecordAccess | null> {
    const result = await this.pool.query<MedicalRecordAccess>(
      `SELECT medical_record_id, patient_id, assigned_doctor_id, status
       FROM medical_records WHERE medical_record_id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async createPrescription(input: {
    recordId: number;
    doctorId: number;
    note: string | null;
    items: Array<{ medicine_name: string; dosage: string; frequency: string; duration: string; instruction: string | null }>;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query<{ prescription_id: number; created_at: Date }>(
        `INSERT INTO prescriptions (medical_record_id, created_by, note)
         VALUES ($1, $2, $3) RETURNING prescription_id, created_at`,
        [input.recordId, input.doctorId, input.note],
      );
      const prescriptionId = created.rows[0].prescription_id;
      for (const item of input.items) {
        await client.query(
          `INSERT INTO prescription_items
           (prescription_id, medicine_name, dosage, frequency, duration, instruction)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [prescriptionId, item.medicine_name, item.dosage, item.frequency, item.duration, item.instruction],
        );
      }
      await client.query('COMMIT');
      return this.getPrescriptionById(prescriptionId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPrescription(recordId: number): Promise<PrescriptionRow | null> {
    const result = await this.pool.query<PrescriptionRow>(
      `SELECT p.prescription_id, p.medical_record_id, p.created_by, p.note, p.created_at,
              COALESCE(json_agg(json_build_object(
                'prescription_item_id', pi.prescription_item_id,
                'medicine_name', pi.medicine_name,
                'dosage', pi.dosage,
                'frequency', pi.frequency,
                'duration', pi.duration,
                'instruction', pi.instruction
              ) ORDER BY pi.prescription_item_id) FILTER (WHERE pi.prescription_item_id IS NOT NULL), '[]'::json) AS items
       FROM prescriptions p
       LEFT JOIN prescription_items pi ON pi.prescription_id = p.prescription_id
       WHERE p.medical_record_id = $1
       GROUP BY p.prescription_id`,
      [recordId],
    );
    return result.rows[0] ?? null;
  }

  private async getPrescriptionById(id: number) {
    const result = await this.pool.query<PrescriptionRow>(
      `SELECT p.prescription_id, p.medical_record_id, p.created_by, p.note, p.created_at,
              COALESCE(json_agg(json_build_object(
                'prescription_item_id', pi.prescription_item_id,
                'medicine_name', pi.medicine_name,
                'dosage', pi.dosage,
                'frequency', pi.frequency,
                'duration', pi.duration,
                'instruction', pi.instruction
              ) ORDER BY pi.prescription_item_id) FILTER (WHERE pi.prescription_item_id IS NOT NULL), '[]'::json) AS items
       FROM prescriptions p
       LEFT JOIN prescription_items pi ON pi.prescription_id = p.prescription_id
       WHERE p.prescription_id = $1
       GROUP BY p.prescription_id`,
      [id],
    );
    return result.rows[0];
  }

  async createLabRequest(input: {
    recordId: number;
    doctorId: number;
    note: string | null;
    items: Array<{ test_name: string; description: string | null }>;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const created = await client.query<{ lab_request_id: number }>(
        `INSERT INTO lab_requests (medical_record_id, requested_by, note, status)
         VALUES ($1, $2, $3, 'pending') RETURNING lab_request_id`,
        [input.recordId, input.doctorId, input.note],
      );
      const requestId = created.rows[0].lab_request_id;
      for (const item of input.items) {
        await client.query(
          `INSERT INTO lab_request_items (lab_request_id, test_name, description)
           VALUES ($1, $2, $3)`,
          [requestId, item.test_name, item.description],
        );
      }
      await client.query('COMMIT');
      return this.getLabRequestById(requestId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listLabRequests(recordId: number) {
    const requests = await this.pool.query<LabRequestRow>(
      `SELECT lab_request_id, medical_record_id, requested_by, status, note, created_at
       FROM lab_requests WHERE medical_record_id = $1
       ORDER BY created_at DESC, lab_request_id DESC`,
      [recordId],
    );
    return Promise.all(requests.rows.map((request) => this.getLabRequestById(request.lab_request_id)));
  }

  async labRequestRecordId(requestId: number): Promise<number | null> {
    const result = await this.pool.query<{ medical_record_id: number }>(
      'SELECT medical_record_id FROM lab_requests WHERE lab_request_id = $1',
      [requestId],
    );
    return result.rows[0]?.medical_record_id ?? null;
  }

  async enterLabResults(input: {
    requestId: number;
    doctorId: number;
    results: Array<{ itemId: number; resultValue: string; resultNote: string | null }>;
  }) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const request = await client.query<{ lab_request_id: number }>(
        'SELECT lab_request_id FROM lab_requests WHERE lab_request_id = $1 FOR UPDATE',
        [input.requestId],
      );
      if (!request.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }
      const itemIds = input.results.map((result) => result.itemId);
      const itemRows = await client.query<{ lab_request_item_id: number }>(
        'SELECT lab_request_item_id FROM lab_request_items WHERE lab_request_id = $1 AND lab_request_item_id = ANY($2::int[])',
        [input.requestId, itemIds],
      );
      if (itemRows.rowCount !== itemIds.length) {
        await client.query('ROLLBACK');
        return { invalidItem: true as const };
      }
      for (const result of input.results) {
        await client.query(
          `INSERT INTO lab_results (lab_request_item_id, result_value, concluded_by, note)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (lab_request_item_id) DO UPDATE
           SET result_value = EXCLUDED.result_value, concluded_by = EXCLUDED.concluded_by,
               note = EXCLUDED.note, updated_at = clock_timestamp()`,
          [result.itemId, result.resultValue, input.doctorId, result.resultNote],
        );
      }
      await client.query(
        `UPDATE lab_requests lr SET status = CASE
           WHEN NOT EXISTS (
             SELECT 1 FROM lab_request_items i
             LEFT JOIN lab_results r ON r.lab_request_item_id = i.lab_request_item_id
             WHERE i.lab_request_id = lr.lab_request_id AND r.lab_result_id IS NULL
           ) THEN 'completed'
           WHEN EXISTS (
             SELECT 1 FROM lab_request_items i
             JOIN lab_results r ON r.lab_request_item_id = i.lab_request_item_id
             WHERE i.lab_request_id = lr.lab_request_id
           ) THEN 'in_progress'
           ELSE 'pending'
         END, updated_at = clock_timestamp()
         WHERE lr.lab_request_id = $1`,
        [input.requestId],
      );
      await client.query('COMMIT');
      return this.getLabRequestById(input.requestId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async getLabRequestById(id: number) {
    const result = await this.pool.query<LabRequestRow & { items: LabItemRow[] }>(
      `SELECT lr.lab_request_id, lr.medical_record_id, lr.requested_by, lr.status, lr.note, lr.created_at,
              COALESCE(json_agg(json_build_object(
                'lab_request_item_id', i.lab_request_item_id,
                'test_name', i.test_name,
                'description', i.description,
                'lab_result_id', r.lab_result_id,
                'result_value', r.result_value,
                'concluded_by', r.concluded_by,
                'result_note', r.note
              ) ORDER BY i.lab_request_item_id) FILTER (WHERE i.lab_request_item_id IS NOT NULL), '[]'::json) AS items
       FROM lab_requests lr
       LEFT JOIN lab_request_items i ON i.lab_request_id = lr.lab_request_id
       LEFT JOIN lab_results r ON r.lab_request_item_id = i.lab_request_item_id
       WHERE lr.lab_request_id = $1
       GROUP BY lr.lab_request_id`,
      [id],
    );
    return result.rows[0];
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
