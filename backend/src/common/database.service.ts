import { HttpException, Injectable, OnModuleDestroy } from '@nestjs/common';
import type pg from 'pg';
import { createDatabasePool } from './database-pool.js';

export function fail(code: string, message: string, status = 400): never {
  throw new HttpException({ code, message, data: {} }, status);
}

export function success(data: unknown, created = false) {
  return {
    code: created ? '1001' : '1000',
    message: created ? 'Created successfully' : 'OK',
    data,
  };
}

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = createDatabasePool(DatabaseService.name);

  async transaction<T>(
    work: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    let client: pg.PoolClient | undefined;
    let discardClient = false;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) await client.query('ROLLBACK').catch(() => { discardClient = true; });
      if (error instanceof HttpException) throw error;
      const code = (error as { code?: string }).code;
      if (code === '23505') {
        const constraint = (error as { constraint?: string }).constraint;
        if (constraint === 'uq_uas7_patient_date')
          fail('5002', 'Score already exists for this date', 409);
        if (constraint === 'uq_answer_attachment')
          fail('6006', 'Image already linked', 409);
        if (constraint === 'uq_users_phone')
          fail('3006', 'User phone already exists', 409);
        if (constraint === 'templates_pkey')
          fail('4102', 'Template code already exists', 409);
        if (constraint === 'uq_templates_active_intake_duration')
          fail(
            '2009',
            'An active template is already configured for this duration; disable or unmap it first',
            409,
          );
        fail('2009', 'Resource already exists', 409);
      }
      if (
        [
          '23503',
          '23514',
          '23502',
          '22001',
          '22P02',
          '22007',
          '22008',
        ].includes(code ?? '')
      ) {
        fail('2003', 'Invalid value or resource is still referenced');
      }
      return fail('9902', 'Database error', 503);
    } finally {
      client?.release(discardClient);
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
