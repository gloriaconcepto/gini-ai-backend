import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());
jest.mock('jwks-rsa', () => ({ JwksClient: jest.fn().mockImplementation(() => ({})) }));
import { GatewayModule } from './gateway.module';
import { createSwaggerDocument } from './swagger.config';
import { exportOpenApi } from '../../../scripts/export-openapi';
import * as fs from 'fs';
import * as path from 'path';

describe('SwaggerConfig & OpenAPI Generator', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [GatewayModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate a valid OpenAPI 3.0 document with expected metadata and auth schemes', () => {
    const document = createSwaggerDocument(app);

    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe('Gini AI Gateway');
    expect(document.info.version).toBe('1.0');

    // Verify security schemes
    const securitySchemes = document.components?.securitySchemes as Record<
      string,
      any
    >;
    expect(securitySchemes).toBeDefined();
    expect(securitySchemes['bearer']).toBeDefined();
    expect(securitySchemes['bearer'].type).toBe('http');
    expect(securitySchemes['bearer'].scheme).toBe('bearer');
    expect(securitySchemes['x-api-key']).toBeDefined();
    expect(securitySchemes['x-api-key'].type).toBe('apiKey');
    expect(securitySchemes['x-api-key'].name).toBe('x-api-key');
  });

  it('should include core API endpoints across all feature domains', () => {
    const document = createSwaggerDocument(app);
    const paths = Object.keys(document.paths);

    // Root health check
    expect(paths).toContain('/');

    // Auth & Tenant resolution endpoints
    expect(paths).toContain('/tenant/resolve');
    expect(paths).toContain('/tenant/workspace');

    // IAM endpoints
    expect(paths).toContain('/iam/users');
    expect(paths).toContain('/iam/roles');
    expect(paths).toContain('/iam/groups');

    // Governance endpoints
    expect(paths).toContain('/iam/governance/requests');
    expect(paths).toContain('/iam/governance/requests/{id}/approve');

    // Audit endpoints
    expect(paths).toContain('/audit/logs');
    expect(paths).toContain('/audit/summary');
    expect(paths).toContain('/audit/export');

    // Document endpoints
    expect(paths).toContain('/documents');
    expect(paths).toContain('/documents/upload-url');
  });

  it('should export openapi specification and pass the checkOnly verification', async () => {
    const testTarget = path.resolve(
      process.cwd(),
      'contracts/test-openapi.json',
    );

    try {
      // Test exportOpenApi generation
      const result = await exportOpenApi({
        checkOnly: false,
        targetFile: testTarget,
      });
      expect(result.updated).toBe(true);
      expect(result.pathCount).toBeGreaterThan(0);
      expect(fs.existsSync(result.targetFile)).toBe(true);

      // Read and verify valid JSON
      const content = JSON.parse(fs.readFileSync(result.targetFile, 'utf8'));
      expect(content.openapi).toMatch(/^3\./);

      // Test checkOnly verification passes with identical file
      const checkResult = await exportOpenApi({
        checkOnly: true,
        targetFile: testTarget,
      });
      expect(checkResult.updated).toBe(false);
      expect(checkResult.pathCount).toBe(result.pathCount);
    } finally {
      if (fs.existsSync(testTarget)) {
        fs.unlinkSync(testTarget);
      }
    }
  });
});
