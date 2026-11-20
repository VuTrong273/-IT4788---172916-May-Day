import { Injectable } from '@nestjs/common';
import type pg from 'pg';
import { DatabaseService, fail, success } from '../common/database.service.js';
import { id, page, text, validate, type Input } from '../common/validation.js';
import { catalogs } from './catalog.config.js';

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  async list(key: string, query: Input) {
    const c = catalogs[key];
    const paging = page(query);
    const values: unknown[] = [];
    const conditions: string[] = [];
    for (const filter of c.filters ?? [])
      if (query[filter] !== undefined) {
        values.push(
          filter === 'method' ? text(query[filter], 10) : id(query[filter]),
        );
        conditions.push(`${filter} = $${values.length}`);
      }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.transaction(async (tx) => {
      const count = await tx.query(
        `SELECT count(*) FROM ${c.table} ${where}`,
        values,
      );
      const rows = await tx.query(
        `SELECT ${c.pk} AS id, * FROM ${c.table} ${where} ORDER BY ${c.pk}${c.paginated ? ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}` : ''}`,
        c.paginated
          ? [...values, paging.limit, (paging.page - 1) * paging.limit]
          : values,
      );
      return {
        ...success(rows.rows),
        ...(c.paginated
          ? { total: Number(count.rows[0].count), ...paging }
          : {}),
      };
    });
  }

  async get(key: string, rawId: string) {
    const c = catalogs[key];
    return this.db.transaction(async (tx) => {
      const row = await tx.query(
        `SELECT ${c.pk} AS id, * FROM ${c.table} WHERE ${c.pk} = $1`,
        [id(rawId)],
      );
      if (!row.rows[0]) fail('2008', 'Resource not found', 404);
      return success(row.rows[0]);
    });
  }

  async write(key: string, body: unknown, rawId?: string) {
    const c = catalogs[key];
    const values = validate(body, c.fields, rawId ? [] : c.required);
    if (!Object.keys(values).length) fail('2001', 'No changes supplied');
    if (
      key === 'api_endpoints' &&
      values.path !== undefined &&
      !/^\/api\/v1\/[A-Za-z0-9_:/-]+$/.test(values.path as string)
    )
      fail('2003', 'Invalid endpoint path');
    return this.db.transaction(async (tx) => {
      if (key === 'roles') {
        // Serialize hierarchy changes to prevent concurrent cycle creation.
        await tx.query('LOCK TABLE roles IN SHARE ROW EXCLUSIVE MODE');
        if (rawId) {
          const existing = await tx.query(
            'SELECT name FROM roles WHERE role_id = $1',
            [id(rawId)],
          );
          if (!existing.rows[0]) fail('2008', 'Role not found', 404);
          if (
            ['admin', 'doctor', 'patient'].includes(existing.rows[0].name) &&
            values.parent_role_id != null
          )
            fail('2003', 'Built-in roles cannot inherit another role');
          if (
            ['admin', 'doctor', 'patient'].includes(existing.rows[0].name) &&
            values.actor_type != null
          )
            fail('2003', 'Built-in role workflows cannot be changed');
          if (
            ['admin', 'doctor', 'patient'].includes(existing.rows[0].name) &&
            values.name !== undefined &&
            values.name !== existing.rows[0].name
          )
            fail('2003', 'Built-in role names cannot be changed');
          if (values.parent_role_id) {
            const ancestors = await tx.query(
              'WITH RECURSIVE parents AS (SELECT role_id, parent_role_id FROM roles WHERE role_id = $1 UNION SELECT r.role_id, r.parent_role_id FROM roles r JOIN parents p ON r.role_id = p.parent_role_id) SELECT 1 FROM parents WHERE role_id = $2',
              [values.parent_role_id, id(rawId)],
            );
            if (ancestors.rowCount) fail('2003', 'Role hierarchy cycle');
          }
        }
        if (values.parent_role_id != null) {
          const parent = (
            await tx.query('SELECT base_role($1) AS name', [
              values.parent_role_id,
            ])
          ).rows[0]?.name;
          if (!['admin', 'doctor'].includes(parent))
            fail(
              '2003',
              'Custom staff roles must inherit an administrator or doctor role',
            );
        }
      }
      const row = await this.save(
        tx,
        c.table,
        c.pk,
        values,
        rawId ? id(rawId) : undefined,
      );
      if (key === 'roles' && rawId) {
        const invalid = await tx.query(
          'WITH RECURSIVE descendants AS (SELECT role_id FROM roles WHERE role_id=$1 UNION SELECT r.role_id FROM roles r JOIN descendants d ON r.parent_role_id=d.role_id) SELECT 1 FROM users u JOIN descendants d USING(role_id) WHERE base_role(u.role_id) IS NULL LIMIT 1',
          [id(rawId)],
        );
        if (invalid.rowCount)
          fail('2003', 'Assigned roles must retain a supported staff workflow');
      }
      return success({ id: row[c.pk], ...row }, !rawId);
    });
  }

  async save(
    tx: pg.PoolClient,
    table: string,
    pk: string,
    data: Input,
    key?: number | string,
  ): Promise<Input> {
    // Identifiers originate exclusively from server-owned resource definitions.
    const columns = Object.keys(data);
    const params = Object.values(data);
    const result =
      key === undefined
        ? await tx.query(
            `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`,
            params,
          )
        : await tx.query(
            `UPDATE ${table} SET ${columns.map((column, i) => `${column} = $${i + 1}`).join(',')} WHERE ${pk} = $${params.length + 1} RETURNING *`,
            [...params, key],
          );
    if (!result.rows[0]) fail('2008', 'Resource not found', 404);
    return result.rows[0];
  }

  async remove(key: string, rawId: string) {
    const c = catalogs[key];
    return this.db.transaction(async (tx) => {
      let affectedRoles: number[] = [];
      if (key === 'roles') {
        await tx.query('LOCK TABLE roles IN SHARE ROW EXCLUSIVE MODE');
        affectedRoles = (
          await tx.query(
            'WITH RECURSIVE descendants AS (SELECT role_id FROM roles WHERE role_id=$1 UNION SELECT r.role_id FROM roles r JOIN descendants d ON r.parent_role_id=d.role_id) SELECT role_id FROM descendants',
            [id(rawId)],
          )
        ).rows.map((row) => row.role_id);
        const role = await tx.query(
          'SELECT name FROM roles WHERE role_id = $1',
          [id(rawId)],
        );
        if (['admin', 'doctor', 'patient'].includes(role.rows[0]?.name))
          fail('2003', 'Built-in roles cannot be deleted');
      }
      const result = await tx.query(
        `DELETE FROM ${c.table} WHERE ${c.pk} = $1 RETURNING ${c.pk}`,
        [id(rawId)],
      );
      if (!result.rowCount) fail('2008', 'Resource not found', 404);
      if (
        affectedRoles.length &&
        (
          await tx.query(
            'SELECT 1 FROM users WHERE role_id=ANY($1::int[]) AND base_role(role_id) IS NULL LIMIT 1',
            [affectedRoles],
          )
        ).rowCount
      )
        fail(
          '2003',
          'Deleting this parent would remove the workflow of an assigned role',
        );
      return success({});
    });
  }
}
