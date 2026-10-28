import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { authorize, fail, type RecordAccess } from './lesions.validation.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';

@Injectable()
export class LesionsRepository implements OnModuleDestroy {
  readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });
  async role(user: AuthenticatedUser) {
    const result = await this.pool.query<{ name: string }>(
      'SELECT name FROM roles WHERE role_id=$1',
      [user.roleId],
    );
    return result.rows[0]?.name ?? null;
  }
  async withRecord<T>(
    user: AuthenticatedUser,
    recordId: number,
    write: boolean,
    action: (client: pg.PoolClient, record: RecordAccess) => Promise<T>,
  ) {
    const role = await this.role(user);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<RecordAccess>(
        'SELECT medical_record_id, patient_id, assigned_doctor_id, status FROM medical_records WHERE medical_record_id=$1 FOR UPDATE',
        [recordId],
      );
      const record = authorize(result.rows[0], user.userId, role, write);
      const value = await action(client, record);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async withPatient<T>(
    user: AuthenticatedUser,
    patientId: number,
    write: boolean,
    action: (client: pg.PoolClient) => Promise<T>,
  ) {
    const role = await this.role(user);
    if (!['patient', 'doctor', 'admin'].includes(role ?? ''))
      fail('3101', 'Permission denied', 403);
    if (
      (role === 'patient' && user.userId !== patientId) ||
      (write && (role !== 'patient' || user.userId !== patientId))
    )
      fail('3106', 'Patient diary is private', 403);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const patient = await client.query(
        'SELECT 1 FROM patients WHERE user_id=$1 FOR KEY SHARE',
        [patientId],
      );
      if (!patient.rowCount) fail('3007', 'Patient not found', 404);
      if (role === 'doctor') {
        const assignment = await client.query(
          'SELECT 1 FROM medical_records WHERE patient_id=$1 AND assigned_doctor_id=$2 LIMIT 1',
          [patientId, user.userId],
        );
        if (!assignment.rowCount)
          fail('3105', 'Doctor is not assigned to this patient', 403);
      }
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async episodePatient(episodeId: number) {
    const result = await this.pool.query<{ patient_id: number }>(
      'SELECT patient_id FROM lesion_episodes WHERE episode_id=$1',
      [episodeId],
    );
    if (!result.rows[0]) fail('7001', 'Lesion episode not found', 404);
    return result.rows[0].patient_id;
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
}
