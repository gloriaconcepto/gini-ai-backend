import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

/**
 * Builds the canonical Swagger OpenAPI specification document for the Gini AI Gateway.
 * Shared across runtime HTTP serving (main.ts) and offline CLI contract generation (scripts/export-openapi.ts).
 */
export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Gini AI Gateway')
    .setDescription('API documentation for the Gini Enterprise AI Gateway')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Keycloak OIDC JWT token',
      },
      'bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'Tenant API Key for machine-to-machine authentication',
      },
      'x-api-key',
    )
    .build();

  return SwaggerModule.createDocument(app, config);
}
