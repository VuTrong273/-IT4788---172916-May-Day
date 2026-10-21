import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

export interface LoginUser {
  user_id: number;
  full_name: string;
  phone: string;
  password_hash: string;
  role_id: number;
  is_active: number;
}

export interface RecoveryTarget {
  user_id: number;
  recovery_email: string | null;
  is_active: number;
}

export type OtpResult = 'success' | 'missing' | 'expired' | 'invalid' | 'conflict';

export interface NewPatient {
  fullName: string;
  phone: string;
  passwordHash: string;
  gender?: 'male' | 'female' | 'other';
  yearOfBirth?: number;
}

export interface CreatedPatient {
  user_id: number;
  full_name: string;
  phone: string;
  gender: 'male' | 'female' | 'other' | null;
  role_id: number;
  is_active: number;
  created_at: Date;
}

export interface AuthState {
  role_id: number;
  is_active: number;
  password_changed_at: Date | null;
  is_blacklisted: boolean;
}

export interface EndpointAccess {
  is_public: number;
  is_allowed: boolean;
}

export interface ProfileRow {
  user_id: number;
  full_name: string;
  phone: string;
  recovery_email: string | null;
  role_id: number;
  gender: string | null;
  year_of_birth: number | null;
  career: string | null;
  ethnic: string | null;
  hamlet_address: string | null;
  commune_address: string | null;
  city_address: string | null;
  work_place: string | null;
  health_insurance_number: string | null;
  health_insurance_validate: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  first_visit: Date | null;
  branch_id: number | null;
  department_id: number | null;
  room_id: number | null;
}

export type ProfileChanges = Record<string, string | number | null>;

export class PatientProfileRequiredError extends Error {}

const PROFILE_SELECT = `SELECT u.user_id, u.full_name, u.phone, u.recovery_email, u.role_id, u.gender,
              p.year_of_birth, p.career, p.ethnic, p.hamlet_address,
              p.commune_address, p.city_address, p.work_place,
              p.health_insurance_number,
              to_char(p.health_insurance_validate, 'YYYY-MM-DD') AS health_insurance_validate,
              p.next_of_kin_name, p.next_of_kin_phone, p.first_visit,
              s.branch_id, s.department_id, s.room_id
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.user_id
       LEFT JOIN staffs s ON s.user_id = u.user_id
       WHERE u.user_id = $1`;

const USER_PROFILE_COLUMNS = new Set(['full_name', 'gender']);
const PATIENT_PROFILE_COLUMNS = new Set([
  'year_of_birth', 'career', 'ethnic', 'hamlet_address', 'commune_address',
  'city_address', 'work_place', 'health_insurance_number',
  'health_insurance_validate', 'next_of_kin_name', 'next_of_kin_phone',
]);

@Injectable()
export class UserRepository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });

  async findByPhone(phone: string): Promise<LoginUser | null> {
    const result = await this.pool.query<LoginUser>(
      `SELECT user_id, full_name, phone, password_hash, role_id, is_active
       FROM users WHERE phone = $1`,
      [phone],
    );
    return result.rows[0] ?? null;
  }

  async requestRecoveryEmail(userId: number, email: string, otpHash: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE users SET pending_recovery_email = $2, email_verify_token = $3,
          email_verify_expires = now() + interval '10 minutes',
          email_verify_sent_at = now(), email_verify_attempts = 0, updated_at = now()
       WHERE user_id = $1 AND is_active = 1
         AND (email_verify_sent_at IS NULL OR email_verify_sent_at < now() - interval '1 minute')
         AND recovery_email IS DISTINCT FROM $2
         AND NOT EXISTS (
           SELECT 1 FROM users other_user
           WHERE other_user.user_id <> $1 AND lower(other_user.recovery_email) = lower($2)
         )`,
      [userId, email, otpHash],
    );
    return Boolean(result.rowCount);
  }

  async cancelRecoveryEmail(userId: number, otpHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET pending_recovery_email = NULL, email_verify_token = NULL,
          email_verify_expires = NULL, email_verify_sent_at = NULL
       WHERE user_id = $1 AND email_verify_token = $2`,
      [userId, otpHash],
    );
  }

  async verifyRecoveryEmail(userId: number, otpHash: string): Promise<OtpResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{
        pending_recovery_email: string | null;
        email_verify_token: string | null;
        email_verify_expires: Date | null;
        email_verify_attempts: number;
      }>(
        `SELECT pending_recovery_email, email_verify_token, email_verify_expires,
                email_verify_attempts FROM users WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );
      const row = result.rows[0];
      if (!row?.email_verify_token || !row.pending_recovery_email) {
        await client.query('COMMIT');
        return 'missing';
      }
      if (!row.email_verify_expires || row.email_verify_expires.getTime() <= Date.now()) {
        await client.query(
          `UPDATE users SET pending_recovery_email = NULL, email_verify_token = NULL,
              email_verify_expires = NULL WHERE user_id = $1`,
          [userId],
        );
        await client.query('COMMIT');
        return 'expired';
      }
      if (row.email_verify_token !== otpHash) {
        await client.query(
          `UPDATE users SET email_verify_attempts = email_verify_attempts + 1,
              email_verify_token = CASE WHEN email_verify_attempts >= 4 THEN NULL ELSE email_verify_token END,
              pending_recovery_email = CASE WHEN email_verify_attempts >= 4 THEN NULL ELSE pending_recovery_email END
           WHERE user_id = $1`,
          [userId],
        );
        await client.query('COMMIT');
        return 'invalid';
      }
      try {
        await client.query(
          `UPDATE users SET recovery_email = pending_recovery_email,
              pending_recovery_email = NULL, email_verify_token = NULL,
              email_verify_expires = NULL, email_verify_attempts = 0,
              reset_token = NULL, reset_token_expires = NULL, updated_at = now()
           WHERE user_id = $1`,
          [userId],
        );
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          await client.query('ROLLBACK');
          return 'conflict';
        }
        throw error;
      }
      await client.query('COMMIT');
      return 'success';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findRecoveryTarget(email: string): Promise<RecoveryTarget | null> {
    const result = await this.pool.query<RecoveryTarget>(
      'SELECT user_id, recovery_email, is_active FROM users WHERE lower(recovery_email) = $1',
      [email],
    );
    return result.rows[0] ?? null;
  }

  async requestPasswordReset(userId: number, otpHash: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE users SET reset_token = $2, reset_token_expires = now() + interval '10 minutes',
          reset_sent_at = now(), reset_attempts = 0
       WHERE user_id = $1 AND recovery_email IS NOT NULL AND is_active = 1
         AND (reset_sent_at IS NULL OR reset_sent_at < now() - interval '1 minute')`,
      [userId, otpHash],
    );
    return Boolean(result.rowCount);
  }

  async cancelPasswordReset(userId: number, otpHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET reset_token = NULL, reset_token_expires = NULL,
          reset_sent_at = NULL WHERE user_id = $1 AND reset_token = $2`,
      [userId, otpHash],
    );
  }

  async finishPasswordReset(email: string, otpHash: string, passwordHash: string): Promise<OtpResult> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{
        user_id: number;
        reset_token: string | null;
        reset_token_expires: Date | null;
      }>(
        `SELECT user_id, reset_token, reset_token_expires FROM users
         WHERE lower(recovery_email) = $1 AND is_active = 1 FOR UPDATE`,
        [email],
      );
      const row = result.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return 'missing';
      }
      if (!row.reset_token || !row.reset_token_expires || row.reset_token_expires.getTime() <= Date.now()) {
        await client.query('COMMIT');
        return 'expired';
      }
      if (row.reset_token !== otpHash) {
        await client.query(
          `UPDATE users SET reset_attempts = reset_attempts + 1,
              reset_token = CASE WHEN reset_attempts >= 4 THEN NULL ELSE reset_token END,
              reset_token_expires = CASE WHEN reset_attempts >= 4 THEN NULL ELSE reset_token_expires END
           WHERE user_id = $1`,
          [row.user_id],
        );
        await client.query('COMMIT');
        return 'invalid';
      }
      await client.query(
        `UPDATE users SET password_hash = $2, password_changed_at = clock_timestamp(),
            reset_token = NULL, reset_token_expires = NULL, reset_attempts = 0,
            updated_at = now() WHERE user_id = $1`,
        [row.user_id, passwordHash],
      );
      await client.query('COMMIT');
      return 'success';
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createPatient(input: NewPatient): Promise<CreatedPatient> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const role = await client.query<{ role_id: number }>(
        `SELECT role_id FROM roles WHERE name = 'patient'`,
      );
      if (!role.rows[0]) throw new Error('Patient role is not configured');

      const created = await client.query<CreatedPatient>(
        `INSERT INTO users (full_name, phone, password_hash, gender, role_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING user_id, full_name, phone, gender, role_id, is_active, created_at`,
        [
          input.fullName,
          input.phone,
          input.passwordHash,
          input.gender ?? null,
          role.rows[0].role_id,
        ],
      );
      const user = created.rows[0];
      await client.query(
        `INSERT INTO patients (user_id, year_of_birth) VALUES ($1, $2)`,
        [user.user_id, input.yearOfBirth ?? null],
      );
      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findAuthState(userId: number, jti: string): Promise<AuthState | null> {
    const result = await this.pool.query<AuthState>(
      `SELECT u.role_id, u.is_active, u.password_changed_at,
              EXISTS (SELECT 1 FROM token_blacklist b
                      WHERE b.user_id = u.user_id AND b.jti = $2) AS is_blacklisted
       FROM users u WHERE u.user_id = $1`,
      [userId, jti],
    );
    return result.rows[0] ?? null;
  }

  async blacklistToken(userId: number, jti: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO token_blacklist (user_id, jti, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (jti) DO NOTHING`,
      [userId, jti, expiresAt],
    );
  }

  async findPasswordHash(userId: number): Promise<string | null> {
    const result = await this.pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId],
    );
    return result.rows[0]?.password_hash ?? null;
  }

  async changePassword(
    userId: number,
    expectedHash: string,
    newHash: string,
    jti: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE users
         SET password_hash = $3, password_changed_at = clock_timestamp(),
             reset_token = NULL, reset_token_expires = NULL, updated_at = now()
         WHERE user_id = $1 AND password_hash = $2`,
        [userId, expectedHash, newHash],
      );
      if (!updated.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query(
        `INSERT INTO token_blacklist (user_id, jti, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (jti) DO NOTHING`,
        [userId, jti, expiresAt],
      );
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findEndpointAccess(
    roleId: number,
    method: string,
    path: string,
  ): Promise<EndpointAccess | null> {
    const result = await this.pool.query<EndpointAccess>(
      `SELECT e.is_public,
              EXISTS (
                SELECT 1
                FROM permissions_endpoints pe
                JOIN role_permissions rp ON rp.permission_id = pe.permission_id
                WHERE pe.endpoint_id = e.endpoint_id AND rp.role_id = $1
              ) AS is_allowed
       FROM api_endpoints e
       WHERE e.method = $2 AND e.path = $3`,
      [roleId, method, path],
    );
    return result.rows[0] ?? null;
  }

  async findProfile(userId: number): Promise<ProfileRow | null> {
    const result = await this.pool.query<ProfileRow>(PROFILE_SELECT, [userId]);
    return result.rows[0] ?? null;
  }

  async updateProfile(userId: number, changes: ProfileChanges): Promise<ProfileRow | null> {
    const userEntries = Object.entries(changes).filter(([key]) => USER_PROFILE_COLUMNS.has(key));
    const patientEntries = Object.entries(changes).filter(([key]) => PATIENT_PROFILE_COLUMNS.has(key));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const account = await client.query('SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE', [userId]);
      if (!account.rowCount) {
        await client.query('ROLLBACK');
        return null;
      }

      if (userEntries.length > 0) {
        const assignments = userEntries.map(([column], index) => `${column} = $${index + 2}`);
        await client.query(
          `UPDATE users SET ${assignments.join(', ')}, updated_at = now() WHERE user_id = $1`,
          [userId, ...userEntries.map(([, value]) => value)],
        );
      }
      if (patientEntries.length > 0) {
        const assignments = patientEntries.map(([column], index) => `${column} = $${index + 2}`);
        const result = await client.query(
          `UPDATE patients SET ${assignments.join(', ')}, updated_at = now() WHERE user_id = $1`,
          [userId, ...patientEntries.map(([, value]) => value)],
        );
        if (!result.rowCount) throw new PatientProfileRequiredError();
      }

      const profile = await client.query<ProfileRow>(PROFILE_SELECT, [userId]);
      await client.query('COMMIT');
      return profile.rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
