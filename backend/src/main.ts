import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createCorsOptions } from './config/cors.js';
import { loadLocalEnvFile, readAppConfig } from './config/env.js';

async function bootstrap() {
  loadLocalEnvFile();
  const config = readAppConfig(process.env);
  const app = await NestFactory.create(AppModule);
  const cors = createCorsOptions(config.nodeEnv, process.env.CORS_ORIGINS);
  if (cors) app.enableCors(cors);
  await app.listen(config.port);
}
await bootstrap();
