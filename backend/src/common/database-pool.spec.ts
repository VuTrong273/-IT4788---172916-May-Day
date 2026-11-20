import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDatabasePool } from './database-pool.js';

describe('database pool background failures', () => {
  afterEach(() => vi.restoreAllMocks());

  it('handles repeated idle connection errors without logging credentials', async () => {
    const warning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const pool = createDatabasePool('RecoveryTest');
    try {
      expect(() => pool.emit('error', new Error('postgresql://user:secret@host/database'))).not.toThrow();
      expect(() => pool.emit('error', new Error('second connection failure'))).not.toThrow();
      expect(warning).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(warning.mock.calls)).not.toContain('secret');
    } finally {
      await pool.end();
    }
  });
});
