import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  minio: {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
  jwtSecret: string;
}

export function loadLocalEnvFile(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

export function readAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const errors: string[] = [];

  function required(name: string): string {
    const value = env[name]?.trim();
    if (!value) {
      errors.push(`${name} is required`);
      return '';
    }
    return value;
  }

  function port(name: string, fallback?: string): number {
    const value = fallback ?? required(name);
    if (!value) {
      return Number.NaN;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      errors.push(`${name} must be an integer from 1 to 65535`);
    }
    return parsed;
  }

  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push('NODE_ENV must be development, test, or production');
  }

  const apiPort = port('PORT', env.PORT?.trim() || '3000');
  const databaseUrl = required('DATABASE_URL');
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !url.hostname ||
        url.pathname.length < 2
      ) {
        errors.push('DATABASE_URL must be a PostgreSQL connection URL');
      }
    } catch {
      errors.push('DATABASE_URL must be a PostgreSQL connection URL');
    }
  }

  const endPoint = required('MINIO_ENDPOINT');
  if (endPoint && /[:/]/.test(endPoint)) {
    errors.push('MINIO_ENDPOINT must be a hostname without scheme or port');
  }
  const minioPort = port('MINIO_PORT');
  const useSSLValue = required('MINIO_USE_SSL');
  if (useSSLValue && useSSLValue !== 'true' && useSSLValue !== 'false') {
    errors.push('MINIO_USE_SSL must be true or false');
  }
  const accessKey = required('MINIO_ACCESS_KEY');
  const secretKey = required('MINIO_SECRET_KEY');
  const bucket = required('MINIO_BUCKET');
  const jwtSecret = required('JWT_SECRET');
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    nodeEnv: nodeEnv as AppConfig['nodeEnv'],
    port: apiPort,
    databaseUrl,
    minio: {
      endPoint,
      port: minioPort,
      useSSL: useSSLValue === 'true',
      accessKey,
      secretKey,
      bucket,
    },
    jwtSecret,
  };
}
