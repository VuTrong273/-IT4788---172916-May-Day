import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { array, id, object, str, validate } from '../common/validation.js';

@Injectable()
export class ClinicalService {
  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: CatalogService,
  ) {}

  private async record(
    tx: pg.PoolClient,
    recordId: number,
    user: AuthenticatedUser,
    write: boolean,
  ) {
    const role = (
      await tx.query('SELECT name FROM roles WHERE role_id = $1', [user.roleId])
    ).rows[0]?.name;
    if (write && role !== 'doctor') fail('3103', 'Doctor role required', 403);
    const record = (
      await tx.query(
        'SELECT * FROM medical_records WHERE medical_record_id = $1 FOR UPDATE',
        [recordId],
      )
    ).rows[0];
    if (!record) fail('4001', 'Medical record not found', 404);
    if (role === 'doctor' && record.assigned_doctor_id !== user.userId)
      fail('3105', 'Doctor is not assigned to this medical record', 403);
    if (role === 'patient' && record.patient_id !== user.userId)
      fail('3106', 'Patient does not own this medical record', 403);
    if (!['doctor', 'patient', 'admin'].includes(role))
      fail('3101', 'Permission denied', 403);
    if (write && record.status === 'completed')
      fail('4003', 'Medical record already completed', 409);
    if (write && record.status !== 'in_progress')
      fail('4002', 'Active medical record required', 409);
    return record;
  }

  async createPrescription(body: unknown, user: AuthenticatedUser) {
    const b = object(body),
      recordId = id(b.medical_record_id);
    if (Array.isArray(b.items) && !b.items.length)
      fail('8001', 'Prescription items cannot be empty');
    const items = array(b.items).map((value) => {
      const item = object(value);
      for (const key of ['medicine_name', 'dosage', 'frequency', 'duration'])
        if (typeof item[key] !== 'string' || !(item[key] as string).trim())
          fail('8002', 'Missing prescription item fields');
      return validate(
        item,
        {
          medicine_name: str(255),
          dosage: str(255),
          frequency: str(255),
          duration: str(255),
          instruction: str(10000, true),
        },
        ['medicine_name', 'dosage', 'frequency', 'duration'],
      );
    });
    const meta = validate(b.note === undefined ? {} : { note: b.note }, {
      note: str(10000, true),
    });
    return this.db.transaction(async (tx) => {
      await this.record(tx, recordId, user, true);
      if (
        (
          await tx.query(
            'SELECT 1 FROM prescriptions WHERE medical_record_id = $1',
            [recordId],
          )
        ).rowCount
      )
        fail('8003', 'Medical record already has a prescription', 409);
      const prescription = await this.catalog.save(
        tx,
        'prescriptions',
        'prescription_id',
        { medical_record_id: recordId, created_by: user.userId, ...meta },
      );
      for (const item of items)
        await this.catalog.save(
          tx,
          'prescription_items',
          'prescription_item_id',
          { prescription_id: prescription.prescription_id, ...item },
        );
      return success(await this.prescription(tx, recordId), true);
    });
  }

  private async prescription(tx: pg.PoolClient, recordId: number) {
    const row = (
      await tx.query(
        'SELECT * FROM prescriptions WHERE medical_record_id = $1',
        [recordId],
      )
    ).rows[0];
    if (!row) fail('2008', 'Prescription not found', 404);
    const items = (
      await tx.query(
        'SELECT prescription_item_id::text, medicine_name, dosage, frequency, duration, instruction FROM prescription_items WHERE prescription_id = $1 ORDER BY prescription_item_id',
        [row.prescription_id],
      )
    ).rows;
    return {
      ...row,
      prescription_id: String(row.prescription_id),
      medical_record_id: String(row.medical_record_id),
      created_by: row.created_by === null ? null : String(row.created_by),
      items,
    };
  }

  async getPrescription(rawId: string, user: AuthenticatedUser) {
    const recordId = id(rawId);
    return this.db.transaction(async (tx) => {
      await this.record(tx, recordId, user, false);
      return success(await this.prescription(tx, recordId));
    });
  }

  async createLabRequest(body: unknown, user: AuthenticatedUser) {
    const b = object(body),
      recordId = id(b.medical_record_id);
    if (Array.isArray(b.items) && !b.items.length)
      fail('8101', 'Lab request items cannot be empty');
    const items = array(b.items).map((value) => {
      const item = object(value);
      if (typeof item.test_name !== 'string' || !item.test_name.trim())
        fail('8102', 'Missing test name');
      return validate(
        item,
        { test_name: str(255), description: str(10000, true) },
        ['test_name'],
      );
    });
    const meta = validate(b.note === undefined ? {} : { note: b.note }, {
      note: str(10000, true),
    });
    return this.db.transaction(async (tx) => {
      await this.record(tx, recordId, user, true);
      const request = await this.catalog.save(
        tx,
        'lab_requests',
        'lab_request_id',
        { medical_record_id: recordId, requested_by: user.userId, ...meta },
      );
      for (const item of items)
        await this.catalog.save(
          tx,
          'lab_request_items',
          'lab_request_item_id',
          { lab_request_id: request.lab_request_id, ...item },
        );
      return success(
        (await this.labRequests(tx, recordId)).find(
          (r) => r.id === String(request.lab_request_id),
        ),
        true,
      );
    });
  }

  private async labRequests(tx: pg.PoolClient, recordId: number) {
    const requests = (
      await tx.query(
        'SELECT * FROM lab_requests WHERE medical_record_id = $1 ORDER BY lab_request_id',
        [recordId],
      )
    ).rows;
    const items = (
      await tx.query(
        `SELECT i.lab_request_id, i.lab_request_item_id::text AS id, i.test_name, i.description,
      r.lab_result_id::text AS result_id, r.result_value, r.concluded_by::text, r.note AS result_note
      FROM lab_request_items i JOIN lab_requests q USING(lab_request_id)
      LEFT JOIN lab_results r USING(lab_request_item_id) WHERE q.medical_record_id = $1 ORDER BY i.lab_request_item_id`,
        [recordId],
      )
    ).rows;
    return requests.map((r) => ({
      id: String(r.lab_request_id),
      medical_record_id: String(r.medical_record_id),
      requested_by: r.requested_by === null ? null : String(r.requested_by),
      status: r.status,
      note: r.note,
      created_at: r.created_at,
      items: items
        .filter((i) => i.lab_request_id === r.lab_request_id)
        .map((i) => ({
          id: i.id,
          test_name: i.test_name,
          description: i.description,
          result_id: i.result_id,
          result_value: i.result_value,
          concluded_by: i.concluded_by,
          result_note: i.result_note,
        })),
    }));
  }

  async getLabResults(rawId: string, user: AuthenticatedUser) {
    const recordId = id(rawId);
    return this.db.transaction(async (tx) => {
      await this.record(tx, recordId, user, false);
      return success(await this.labRequests(tx, recordId));
    });
  }

  async enterResults(body: unknown, user: AuthenticatedUser) {
    const b = object(body),
      requestId = id(b.lab_request_id);
    const results = array(b.results).map((value) => {
      const item = object(value);
      const itemId = id(item.lab_request_item_id);
      return {
        itemId,
        values: validate(
          {
            result_value: item.result_value,
            ...(item.result_note === undefined
              ? {}
              : { result_note: item.result_note }),
          },
          {
            result_value: str(10000),
            result_note: { ...str(10000, true), column: 'note' },
          },
          ['result_value'],
        ),
      };
    });
    if (new Set(results.map((r) => r.itemId)).size !== results.length)
      fail('2003', 'Duplicate lab request items');
    return this.db.transaction(async (tx) => {
      const request = (
        await tx.query('SELECT * FROM lab_requests WHERE lab_request_id = $1', [
          requestId,
        ])
      ).rows[0];
      if (!request) fail('8103', 'Lab request not found', 404);
      await this.record(tx, request.medical_record_id, user, true);
      await tx.query(
        'SELECT 1 FROM lab_requests WHERE lab_request_id = $1 FOR UPDATE',
        [requestId],
      );
      const owned = await tx.query(
        'SELECT lab_request_item_id FROM lab_request_items WHERE lab_request_id = $1',
        [requestId],
      );
      const ids = new Set(owned.rows.map((i) => i.lab_request_item_id));
      for (const result of results) {
        if (!ids.has(result.itemId))
          fail('2003', 'Item does not belong to this lab request');
        await tx.query(
          `INSERT INTO lab_results(lab_request_item_id, result_value, concluded_by, note) VALUES($1,$2,$3,$4)
          ON CONFLICT(lab_request_item_id) DO UPDATE SET result_value = EXCLUDED.result_value, concluded_by = EXCLUDED.concluded_by, note = EXCLUDED.note`,
          [
            result.itemId,
            result.values.result_value,
            user.userId,
            result.values.note ?? null,
          ],
        );
      }
      await tx.query(
        `UPDATE lab_requests SET status = CASE WHEN NOT EXISTS (
        SELECT 1 FROM lab_request_items i LEFT JOIN lab_results r USING(lab_request_item_id)
        WHERE i.lab_request_id = $1 AND r.lab_result_id IS NULL) THEN 'completed' ELSE 'in_progress' END WHERE lab_request_id = $1`,
        [requestId],
      );
      return success(
        (await this.labRequests(tx, request.medical_record_id)).find(
          (r) => r.id === String(requestId),
        ),
        true,
      );
    });
  }
}
