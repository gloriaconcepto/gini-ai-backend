import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);

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

  await app.listen(process.env.port ?? 3000);
}
bootstrap();

