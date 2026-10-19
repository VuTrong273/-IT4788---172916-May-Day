import { describe, expect, it } from 'vitest';
import { readAppConfig } from './env.js';

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://mayday:local@localhost:5432/mayday',
  MINIO_ENDPOINT: 'localhost',
  MINIO_PORT: '9000',
  MINIO_USE_SSL: 'false',
  MINIO_ACCESS_KEY: 'local-access-key',
  MINIO_SECRET_KEY: 'local-secret-key',
  MINIO_BUCKET: 'mayday-images',
  JWT_SECRET: 'a'.repeat(32),
};

describe('readAppConfig', () => {
  it('reads and converts valid values', () => {
    expect(readAppConfig(validEnv)).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      minio: { port: 9000, useSSL: false },
    });
  });

  it('lists missing required variables without printing secret values', () => {
    expect(() => readAppConfig({})).toThrow(/DATABASE_URL is required/);
    expect(() => readAppConfig({})).toThrow(/JWT_SECRET is required/);
  });

  it('rejects invalid ports, storage settings, and a short JWT secret', () => {
    const invalidEnv = {
      ...validEnv,
      PORT: '70000',
      MINIO_USE_SSL: 'yes',
      JWT_SECRET: 'short',
    };
    expect(() => readAppConfig(invalidEnv)).toThrow(/PORT must be an integer/);
    expect(() => readAppConfig(invalidEnv)).toThrow(
      /MINIO_USE_SSL must be true or false/,
    );
    expect(() => readAppConfig(invalidEnv)).toThrow(
      /JWT_SECRET must be at least 32 characters/,
    );
  });
});
