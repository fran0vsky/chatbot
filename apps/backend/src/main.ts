import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({
    origin: process.env['CORS_ORIGIN'] || 'http://localhost:4200',
  });

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  // Raise the body-parser limit so chat requests carrying base64 image data URLs
  // (up to ~1.5 MB for a 1024px JPEG) plus capped conversation history are accepted
  // instead of being rejected with HTTP 413 (Express default is 100 kb).
  const bodyLimit = process.env['BODY_LIMIT'] || '10mb';
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  // Serve the baked-in Angular static build if present. Dockerfile copies
  // dist/apps/frontend/browser into ./dist/frontend; locally that path is
  // empty so the check makes this a no-op for `nx serve backend`.
  const frontendDir = join(__dirname, 'frontend');
  if (existsSync(frontendDir)) {
    app.useStaticAssets(frontendDir);
    Logger.log(`Serving static frontend from ${frontendDir}`);
  }

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
}

bootstrap();
