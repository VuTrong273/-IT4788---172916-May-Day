import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

const DEVELOPMENT_PORTS = ['8081', '5173', '4173'];
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1'];

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return false;
  return (
    parts[0] === 10 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  );
}

function isDevelopmentLanOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      url.protocol === 'http:' &&
      isPrivateIpv4(url.hostname) &&
      DEVELOPMENT_PORTS.includes(url.port)
    );
  } catch {
    return false;
  }
}

export function createCorsOptions(
  nodeEnv: string,
  configured = '',
): CorsOptions | undefined {
  const development = nodeEnv === 'development';
  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (development) {
    for (const host of LOOPBACK_HOSTS) {
      for (const port of DEVELOPMENT_PORTS)
        origins.push(`http://${host}:${port}`);
    }
  }
  if (!origins.length) return undefined;
  const allowedOrigins = new Set(origins);

  return {
    origin: (origin, callback) =>
      callback(
        null,
        !origin ||
          allowedOrigins.has(origin) ||
          (development && isDevelopmentLanOrigin(origin)),
      ),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  };
}
