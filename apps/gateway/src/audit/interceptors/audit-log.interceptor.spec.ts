import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditService } from '../services/audit.service';
import { AuditActionCategory, AuditStatus } from '../audit.types';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let reflector: Reflector;
  let auditService: AuditService;

  beforeEach(() => {
    reflector = new Reflector();
    auditService = {
      recordLog: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;

    interceptor = new AuditLogInterceptor(reflector, auditService);
  });

  const createMockContext = (
    method: string,
    path: string,
    body?: any,
    user?: any,
    headers: Record<string, string> = {},
  ): ExecutionContext => {
    const request = {
      method,
      path,
      route: { path },
      body,
      user,
      headers: {
        'user-agent': 'JestTestRunner',
        ...headers,
      },
      params: { id: 'resource-123' },
      query: {},
      ip: '127.0.0.1',
    };
    const response = {
      statusCode: 200,
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  const createCallHandler = (response: any = { ok: true }): CallHandler => ({
    handle: () => of(response),
  });

  it('should skip interception when @SkipAudit() is set', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const context = createMockContext('POST', '/iam/users');
    const handler = createCallHandler();

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).not.toHaveBeenCalled();
      done();
    });
  });

  it('should skip non-mutating GET requests without @Audited() metadata', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext('GET', '/iam/users');
    const handler = createCallHandler();

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).not.toHaveBeenCalled();
      done();
    });
  });

  it('should intercept mutating POST request and record success audit log', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const user = {
      userId: 'admin-1',
      username: 'adminUser',
      tenantId: 'tenant-omega',
      roles: ['admin'],
      issuer: 'keycloak',
    };
    const context = createMockContext(
      'POST',
      '/iam/users',
      { name: 'John' },
      user,
    );
    const handler = createCallHandler({ id: 'new-user-1' });

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-omega',
          httpMethod: 'POST',
          operation: 'POST_/iam/users',
          status: AuditStatus.SUCCESS,
          resourceId: 'resource-123',
          actor: expect.objectContaining({
            actorId: 'admin-1',
            actorType: 'USER',
            username: 'adminUser',
          }),
        }),
      );
      done();
    });
  });

  it('should recognize API key actor type', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const user = {
      userId: 'apikey-1',
      username: 'service-key',
      tenantId: 'tenant-beta',
      roles: ['service'],
      issuer: 'local-api-key',
    };
    const context = createMockContext(
      'DELETE',
      '/iam/users/123',
      undefined,
      user,
    );
    const handler = createCallHandler();

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: expect.objectContaining({
            actorId: 'apikey-1',
            actorType: 'API_KEY',
          }),
        }),
      );
      done();
    });
  });

  it('should intercept annotated GET route with @Audited() options', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'audit:metadata') {
        return {
          category: AuditActionCategory.SYSTEM,
          operation: 'VIEW_TENANT_METRICS',
          resourceType: 'system_metrics',
        };
      }
      return undefined;
    });

    const context = createMockContext('GET', '/system/metrics');
    const handler = createCallHandler();

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AuditActionCategory.SYSTEM,
          operation: 'VIEW_TENANT_METRICS',
          resourceType: 'system_metrics',
        }),
      );
      done();
    });
  });

  it('should handle anonymous callers and infer categories and resources from path', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext('POST', '/api-keys/create', {
      name: 'key',
    });
    const handler = createCallHandler({ id: 'key-1' });

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AuditActionCategory.API_KEY,
          resourceType: 'api_key',
          actor: expect.objectContaining({
            actorType: 'ANONYMOUS',
            actorId: 'anonymous',
          }),
        }),
      );
      done();
    });
  });

  it('should infer categories and resource types for tenant and system paths', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext('POST', '/tenant/resolve');
    const handler = createCallHandler();

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AuditActionCategory.AUTH,
          resourceType: 'tenant',
        }),
      );
      done();
    });
  });

  it('should infer roles, clients, and idp resource types', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext('POST', '/iam/identity-providers');
    const handler = createCallHandler();

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'identity_provider',
        }),
      );
      done();
    });
  });

  it('should extract custom resourceId when extractResourceId option is supplied', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'audit:metadata') {
        return {
          extractResourceId: (req: any) => `custom-${req.body?.customId}`,
        };
      }
      return undefined;
    });

    const context = createMockContext('POST', '/iam/custom', {
      customId: '99',
    });
    const handler = createCallHandler();

    interceptor.intercept(context, handler).subscribe(() => {
      expect(auditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'custom-99',
        }),
      );
      done();
    });
  });

  it('should record failure audit log on error and propagate the error', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext('POST', '/iam/roles');
    const error = { status: 403, message: 'Forbidden' };
    const handler: CallHandler = {
      handle: () => throwError(() => error),
    };

    interceptor.intercept(context, handler).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(auditService.recordLog).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
            status: AuditStatus.DENIED,
            errorMessage: 'Forbidden',
          }),
        );
        done();
      },
    });
  });
});
