import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadLocalEnvFile, readAppConfig } from './config/env.js';

async function bootstrap() {
  loadLocalEnvFile();
  const config = readAppConfig(process.env);
  const app = await NestFactory.create(AppModule);
  await app.listen(config.port);
}
await bootstrap();
