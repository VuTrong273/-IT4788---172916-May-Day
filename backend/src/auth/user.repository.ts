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
    const result = await this.pool.query<ProfileRow>(
      `SELECT u.user_id, u.full_name, u.phone, u.role_id, u.gender,
              p.year_of_birth, p.career, p.ethnic, p.hamlet_address,
              p.commune_address, p.city_address, p.work_place,
              p.health_insurance_number,
              to_char(p.health_insurance_validate, 'YYYY-MM-DD') AS health_insurance_validate,
              p.next_of_kin_name, p.next_of_kin_phone, p.first_visit,
              s.branch_id, s.department_id, s.room_id
       FROM users u
       LEFT JOIN patients p ON p.user_id = u.user_id
       LEFT JOIN staffs s ON s.user_id = u.user_id
       WHERE u.user_id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
