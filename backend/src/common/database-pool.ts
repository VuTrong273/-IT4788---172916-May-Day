import { Logger } from '@nestjs/common';
import pg from 'pg';

export function createDatabasePool(context: string): pg.Pool {
  const logger = new Logger(context);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5000,
    max: 10,
  });
  // pg removes a failed idle client itself. Handle its background error so
  // Node stays alive and the next request can establish a fresh connection.
  pool.on('error', () => {
    logger.warn('PostgreSQL idle connection lost; the pool will reconnect on demand.');
  });
  return pool;
}
