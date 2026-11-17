import { Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import {
  id,
  int,
  page,
  str,
  text,
  validate,
  type Fields,
  type Input,
} from '../common/validation.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';

const userFields: Fields = {
  full_name: str(150),
  phone: str(10),
  password: str(72),
  gender: { ...str(10), values: ['male', 'female', 'other'] },
  role_id: int(),
  is_active: int(0, 1),
};
const patientFields: Fields = {
  year_of_birth: int(1900, 2100, true),
  career: str(150, true),
  ethnic: str(50, true),
  hamlet_address: str(150, true),
  commune_address: str(150, true),
  city_address: str(150, true),
  work_place: str(255, true),
  health_insurance_number: str(30, true),
  health_insurance_validate: str(10, true),
  next_of_kin_name: str(150, true),
  next_of_kin_phone: str(20, true),
};
const assignmentFields = {
  branch_id: int(),
  department_id: int(),
  room_id: int(1, 2147483647, true),
};
const userSelect = `SELECT u.user_id, u.full_name, u.phone, u.gender, u.role_id, u.is_active, u.created_at, u.updated_at,
  p.year_of_birth, p.career, p.ethnic, p.hamlet_address, p.commune_address, p.city_address, p.work_place,
  p.health_insurance_number, to_char(p.health_insurance_validate, 'YYYY-MM-DD') AS health_insurance_validate,
  p.next_of_kin_name, p.next_of_kin_phone, p.first_visit, s.branch_id, s.department_id, s.room_id
  FROM users u LEFT JOIN patients p USING(user_id) LEFT JOIN staffs s USING(user_id)`;

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly catalog: CatalogService,
  ) {}

  async create(body: unknown, kind: 'user' | 'staff' | 'patient') {
    const fields: Fields = {
      ...userFields,
      ...(kind === 'staff' ? assignmentFields : {}),
      ...(kind === 'patient' ? patientFields : {}),
    };
    if (kind === 'patient') {
      delete fields.role_id;
      delete fields.is_active;
    }
    const data = validate(body, fields, [
      'full_name',
      'phone',
      'password',
      ...(kind !== 'patient' ? ['role_id'] : []),
      ...(kind === 'staff' ? ['branch_id', 'department_id'] : []),
    ]);
    if (!/^(03|05|07|08|09)\d{8}$/.test(String(data.phone)))
      fail('2004', 'Invalid phone number format');
    if (
      String(data.password).length < 6 ||
      Buffer.byteLength(String(data.password)) > 72
    )
      fail('2003', 'Password must contain 6 to 72 bytes');
    // Passwords are not trimmed: whitespace is significant for authentication.
    data.password_hash = await hash((body as Input).password as string, 10);
    delete data.password;
    if (
      data.health_insurance_validate !== undefined &&
      data.health_insurance_validate !== null &&
      !/^\d{4}-\d{2}-\d{2}$/.test(data.health_insurance_validate as string)
    )
      fail('2003', 'Invalid insurance date');
    return this.db.transaction(async (tx) => {
      const role =
        kind === 'patient'
          ? await tx.query(
              "SELECT role_id, name FROM roles WHERE name = 'patient'",
            )
          : await tx.query(
              'SELECT role_id, name FROM roles WHERE role_id = $1',
              [data.role_id],
            );
      if (!role.rows[0]) fail('2003', 'Unknown role');
      if (kind === 'staff' && role.rows[0].name === 'patient')
        fail('2003', 'Patient cannot be assigned as staff');
      data.role_id = role.rows[0].role_id;
      const account = Object.fromEntries(
        Object.entries(data).filter(
          ([key]) => key in userFields || key === 'password_hash',
        ),
      );
      const user = await this.catalog.save(tx, 'users', 'user_id', account);
      if (role.rows[0].name === 'patient') {
        const profile = Object.fromEntries(
          Object.entries(data).filter(([key]) => key in patientFields),
        );
        await this.catalog.save(tx, 'patients', 'user_id', {
          user_id: user.user_id,
          ...profile,
        });
      }
      if (kind === 'staff')
        await this.catalog.save(tx, 'staffs', 'user_id', {
          user_id: user.user_id,
          branch_id: data.branch_id,
          department_id: data.department_id,
          room_id: data.room_id ?? null,
        });
      return success(
        (await tx.query(`${userSelect} WHERE u.user_id = $1`, [user.user_id]))
          .rows[0],
        true,
      );
    });
  }

  async list(query: Input, patientsOnly = false) {
    const paging = page(query);
    const values: unknown[] = [];
    const where: string[] = [];
    if (
      patientsOnly &&
      query.phone === undefined &&
      query.full_name === undefined
    )
      fail('2001', 'Supply phone or full_name');
    if (patientsOnly)
      where.push(
        "EXISTS (SELECT 1 FROM roles r WHERE r.role_id = u.role_id AND r.name = 'patient')",
      );
    for (const field of ['phone', 'full_name'])
      if (patientsOnly && query[field] !== undefined) {
        const term = text(query[field], field === 'phone' ? 10 : 150).replace(
          /[\\%_]/g,
          '\\$&',
        );
        values.push(field === 'phone' ? `${term}%` : `%${term}%`);
        where.push(`u.${field} ILIKE $${values.length}`);
      }
    const search = query.keyword ?? query.search;
    if (search !== undefined) {
      values.push(`%${text(search, 150).replace(/[\\%_]/g, '\\$&')}%`);
      where.push(
        `(u.full_name ILIKE $${values.length} OR u.phone ILIKE $${values.length})`,
      );
    }
    for (const field of ['role_id', 'is_active'])
      if (query[field] !== undefined) {
        values.push(
          field === 'role_id' ? id(query[field]) : intQuery(query[field]),
        );
        where.push(`u.${field} = $${values.length}`);
      }
    const condition = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    return this.db.transaction(async (tx) => {
      const count = await tx.query(
        `SELECT count(*) FROM users u${condition}`,
        values,
      );
      const rows = await tx.query(
        `${userSelect}${condition} ORDER BY u.user_id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, paging.limit, (paging.page - 1) * paging.limit],
      );
      return {
        ...success(rows.rows),
        total: Number(count.rows[0].count),
        ...paging,
      };
    });
  }

  async get(rawId: string) {
    const userId = id(rawId);
    return this.db.transaction(async (tx) => {
      const result = await tx.query(`${userSelect} WHERE u.user_id = $1`, [
        userId,
      ]);
      if (!result.rows[0]) fail('3007', 'User account not found', 404);
      return success(result.rows[0]);
    });
  }

  async update(rawId: string, body: unknown, actor: AuthenticatedUser) {
    const userId = id(rawId);
    const data = validate(body, {
      full_name: userFields.full_name,
      gender: userFields.gender,
      role_id: int(),
      is_active: int(0, 1),
    });
    if (!Object.keys(data).length) fail('2001', 'No changes supplied');
    return this.db.transaction(async (tx) => {
      await tx.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const current = await tx.query(
        'SELECT u.*, r.name AS role_name FROM users u JOIN roles r USING(role_id) WHERE user_id = $1 FOR UPDATE OF u',
        [userId],
      );
      const user = current.rows[0];
      if (!user) fail('3007', 'User account not found', 404);
      if (
        actor.userId === userId &&
        (data.is_active === 0 ||
          (data.role_id !== undefined && data.role_id !== user.role_id))
      )
        fail('2003', 'Cannot deactivate or change your own role');
      if (data.role_id !== undefined && data.role_id !== user.role_id) {
        const target = await tx.query(
          'SELECT name FROM roles WHERE role_id = $1',
          [data.role_id],
        );
        if (!target.rows[0]) fail('2003', 'Unknown role');
        if (
          (target.rows[0].name === 'patient') !==
          (user.role_name === 'patient')
        )
          fail(
            '2003',
            'Cannot convert a patient account to staff or staff to patient',
          );
      }
      if (
        user.role_name === 'admin' &&
        user.is_active === 1 &&
        (data.is_active === 0 ||
          (data.role_id !== undefined && data.role_id !== user.role_id))
      ) {
        const admins = await tx.query(
          "SELECT count(*) FROM users u JOIN roles r USING(role_id) WHERE r.name = 'admin' AND u.is_active = 1",
        );
        if (Number(admins.rows[0].count) <= 1)
          fail('2003', 'At least one active administrator is required');
      }
      await this.catalog.save(tx, 'users', 'user_id', data, userId);
      return success(
        (await tx.query(`${userSelect} WHERE u.user_id = $1`, [userId]))
          .rows[0],
      );
    });
  }

  async assign(rawId: string, body: unknown) {
    const userId = id(rawId);
    const data = validate(body, assignmentFields, [
      'branch_id',
      'department_id',
    ]);
    return this.db.transaction(async (tx) => {
      const user = await tx.query(
        'SELECT r.name FROM users u JOIN roles r USING(role_id) WHERE user_id = $1 FOR UPDATE OF u',
        [userId],
      );
      if (!user.rows[0]) fail('3007', 'User account not found', 404);
      if (user.rows[0].name === 'patient')
        fail('2003', 'Patient cannot be assigned as staff');
      const result = await tx.query(
        'INSERT INTO staffs(user_id, branch_id, department_id, room_id) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET branch_id = EXCLUDED.branch_id, department_id = EXCLUDED.department_id, room_id = EXCLUDED.room_id RETURNING user_id, branch_id, department_id, room_id',
        [userId, data.branch_id, data.department_id, data.room_id ?? null],
      );
      return success(result.rows[0]);
    });
  }

  async remove(rawId: string, actor: AuthenticatedUser) {
    const userId = id(rawId);
    if (userId === actor.userId) fail('2003', 'Cannot delete your own account');
    return this.db.transaction(async (tx) => {
      await tx.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const user = (
        await tx.query(
          'SELECT u.is_active, r.name FROM users u JOIN roles r USING(role_id) WHERE user_id = $1',
          [userId],
        )
      ).rows[0];
      if (user?.name === 'admin' && user.is_active === 1) {
        const admins = await tx.query(
          "SELECT count(*) FROM users u JOIN roles r USING(role_id) WHERE r.name = 'admin' AND u.is_active = 1",
        );
        if (Number(admins.rows[0].count) <= 1)
          fail('2003', 'At least one active administrator is required');
      }
      const row = await tx.query(
        'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
        [userId],
      );
      if (!row.rowCount) fail('3007', 'User account not found', 404);
      return success({});
    });
  }
}

function intQuery(value: unknown) {
  if (value !== '0' && value !== '1') fail('2003', 'Invalid active flag');
  return Number(value);
}
