import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadLocalEnvFile, readAppConfig } from './config/env.js';

async function bootstrap() {
  loadLocalEnvFile();
  const config = readAppConfig(process.env);
  const app = await NestFactory.create(AppModule);
  const devOrigins = config.nodeEnv === 'development'
    ? ['http://localhost:8081', 'http://127.0.0.1:8081']
    : [];
  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
  const allowedOrigins = [...new Set([...devOrigins, ...configuredOrigins])];
  if (allowedOrigins.length > 0) {
    app.enableCors({
      origin: allowedOrigins,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    });
  }
  // Accept LAN connections from phones running the Expo app.
  await app.listen(config.port, '0.0.0.0');
}
await bootstrap();
