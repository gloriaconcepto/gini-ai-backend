import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

  // Increase max HTTP header size on underlying HTTP server (default 16KB -> 64KB)
  const server = app.getHttpServer();
  server.maxHeaderSize = 65536;

  // Configure CORS with explicit origin validation (eliminating reflected origin vulnerability)
  const corsOriginsEnv =
    process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS;
  const configuredCorsOrigins = corsOriginsEnv
    ? corsOriginsEnv
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    : [];

  const corsOriginValidator = (
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!requestOrigin) {
      return callback(null, true);
    }
    const normalizedOrigin = requestOrigin.replace(/\/+$/, '');
    if (configuredCorsOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production') {
      const isLocalhost =
        /^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(
          normalizedOrigin,
        );
      if (isLocalhost) {
        return callback(null, true);
      }
    }
    return callback(
      new Error(`CORS blocked for origin: ${requestOrigin}`),
      false,
    );
  };

  app.enableCors({
    origin: corsOriginValidator,
    credentials: true,
    exposedHeaders: ['X-Tenant-ID'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Tenant-ID',
      'x-api-key',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Enable global validation pipe for class-validator
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Initialize Swagger
  const config = new DocumentBuilder()
    .setTitle('Gini AI Gateway')
    .setDescription('API documentation for the Gini Enterprise AI Gateway')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start Gateway application', err);
  process.exit(1);
});
