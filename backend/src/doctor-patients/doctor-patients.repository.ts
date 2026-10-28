import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import {
  patientTextLimits,
  type PatientInput,
} from './doctor-patients.validation.js';

export type PatientSummary = {
  user_id: number;
  full_name: string;
  phone: string;
  gender: string | null;
  year_of_birth: number | null;
  created_at: Date;
};

@Injectable()
export class DoctorPatientsRepository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });

  async roleName(roleId: number) {
    const result = await this.pool.query<{ name: string }>(
      'SELECT name FROM roles WHERE role_id = $1',
      [roleId],
    );
    return result.rows[0]?.name;
  }

  async search(phone: string, name: string) {
    // Escape LIKE metacharacters so user input is treated as literal text.
    const escape = (value: string) => value.replace(/[\\%_]/g, '\\$&');
    const result = await this.pool.query<PatientSummary>(
      `SELECT u.user_id, u.full_name, u.phone, u.gender, p.year_of_birth, u.created_at
       FROM patients p JOIN users u ON u.user_id = p.user_id
       WHERE ($1 = '' OR u.phone LIKE $2) AND ($3 = '' OR u.full_name ILIKE $4)
       ORDER BY lower(u.full_name), u.user_id`,
      [phone, `${escape(phone)}%`, name, `%${escape(name)}%`],
    );
    return result.rows;
  }

  async create(
    input: Omit<PatientInput, 'password'> & { passwordHash: string },
  ) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const role = await client.query<{ role_id: number }>(
        "SELECT role_id FROM roles WHERE name = 'patient'",
      );
      if (!role.rows[0]) throw new Error('Patient role is not configured');
      const result = await client.query<
        Omit<PatientSummary, 'year_of_birth'> & { role_id: number }
      >(
        `INSERT INTO users (full_name, phone, password_hash, gender, role_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, full_name, phone, gender, role_id, created_at`,
        [
          input.fullName,
          input.phone,
          input.passwordHash,
          input.gender,
          role.rows[0].role_id,
        ],
      );
      const user = result.rows[0];
      const columns = [
        ...Object.keys(patientTextLimits),
        'health_insurance_validate',
      ];
      await client.query(
        `INSERT INTO patients (user_id, year_of_birth, ${columns.join(', ')})
         VALUES ($1, $2, ${columns.map((_, index) => `$${index + 3}`).join(', ')})`,
        [
          user.user_id,
          input.yearOfBirth,
          ...columns.map((key) => input.details[key]),
        ],
      );
      await client.query('COMMIT');
      return { ...user, year_of_birth: input.yearOfBirth };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
