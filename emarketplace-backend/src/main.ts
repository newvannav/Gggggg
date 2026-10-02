import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);

  app.setGlobalPrefix('v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips unknown props — request bodies can't smuggle fields
      forbidNonWhitelisted: true, // 400 on unexpected fields
      transform: true, // DTO-decorated coercion (numbers, bigints via DTOs)
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableCors({ origin: config.get('corsOrigin'), credentials: true });
  app.enableShutdownHooks();

  const port = config.get('port');
  await app.listen(port);
  Logger.log(`e-marketplace API listening on :${port} (prefix /v1)`);
}

void bootstrap();
