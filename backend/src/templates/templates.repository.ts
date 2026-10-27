import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

export type TemplateSummary = {
  code_template: string;
  name: string;
  description: string | null;
  version: string;
  is_active: string;
  created_at: Date;
};

@Injectable()
export class TemplatesRepository implements OnModuleDestroy {
  private readonly pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 10 });

  async roleName(roleId: number) {
    const result = await this.pool.query<{ name: string }>('SELECT name FROM roles WHERE role_id = $1', [roleId]);
    return result.rows[0]?.name ?? null;
  }

  async list(page: number, limit: number, active?: '0' | '1') {
    const values: unknown[] = [];
    const where = active === undefined ? '' : 'WHERE is_active = $1';
    if (active !== undefined) values.push(Number(active));
    const count = await this.pool.query<{ count: string }>(`SELECT count(*) FROM templates ${where}`, values);
    const result = await this.pool.query<TemplateSummary>(
      `SELECT code_template, name, description, version, is_active::text, created_at
       FROM templates ${where} ORDER BY created_at DESC, code_template
       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, (page - 1) * limit],
    );
    return { data: result.rows, total: Number(count.rows[0].count), page, limit };
  }

  async create(input: { code: string; name: string; description: string | null; version: string; active: '0' | '1'; userId: number }) {
    const result = await this.pool.query<TemplateSummary>(
      `INSERT INTO templates (code_template, name, description, version, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING code_template, name, description, version, is_active::text, created_at`,
      [input.code, input.name, input.description, input.version, Number(input.active), input.userId],
    );
    return result.rows[0];
  }

  async onModuleDestroy() { await this.pool.end(); }
}
