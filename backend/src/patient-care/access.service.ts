import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { fail } from '../common/database.service.js';
import { id } from '../common/validation.js';

@Injectable()
export class PatientAccessService {
  async role(tx: pg.PoolClient, user: AuthenticatedUser) {
    return (
      await tx.query<{ name: string }>(
        'SELECT name FROM roles WHERE role_id=$1',
        [user.roleId],
      )
    ).rows[0]?.name;
  }
  async record(
    tx: pg.PoolClient,
    user: AuthenticatedUser,
    rawId: unknown,
    write = false,
  ) {
    const role = await this.role(tx, user);
    const row = (
      await tx.query(
        'SELECT * FROM medical_records WHERE medical_record_id=$1 FOR UPDATE',
        [id(rawId)],
      )
    ).rows[0];
    if (!row) fail('4001', 'Medical record not found', 404);
    if (role === 'patient' && row.patient_id !== user.userId)
      fail('3106', "Cannot access another user's data", 403);
    if (
      role === 'doctor' &&
      row.assigned_doctor_id !== user.userId &&
      !(row.status === 'pending' && row.assigned_doctor_id === null && !write)
    )
      fail('3105', 'Doctor is not assigned to this medical record', 403);
    if (!['admin', 'doctor', 'patient'].includes(role ?? ''))
      fail('3101', 'Permission denied', 403);
    if (write && row.status === 'completed')
      fail('4003', 'Medical record already completed', 409);
    return { row, role };
  }
  async patient(tx: pg.PoolClient, user: AuthenticatedUser, rawId: unknown) {
    const patientId = id(rawId);
    const role = await this.role(tx, user);
    if (role === 'patient' && patientId !== user.userId)
      fail('3106', "Cannot access another user's data", 403);
    if (role === 'doctor') {
      const assigned = await tx.query(
        'SELECT 1 FROM medical_records WHERE patient_id=$1 AND assigned_doctor_id=$2 LIMIT 1',
        [patientId, user.userId],
      );
      if (!assigned.rowCount)
        fail('3105', 'Doctor is not assigned to this patient', 403);
    }
    if (!['admin', 'doctor', 'patient'].includes(role ?? ''))
      fail('3101', 'Permission denied', 403);
    return { patientId, role };
  }
}

export function dateOnly(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    fail('2006', 'Invalid date format');
  return value;
}
export function stringNumbers(
  row: Record<string, unknown>,
  extra: string[] = [],
) {
  const out = { ...row };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (
      (key === 'id' || key.endsWith('_id') || extra.includes(key)) &&
      (typeof value === 'number' || typeof value === 'string')
    )
      out[key] = String(value);
  }
  return out;
}
