import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuditorGuard } from './auditor.guard';

describe('AuditorGuard', () => {
  let guard: AuditorGuard;

  beforeEach(() => {
    guard = new AuditorGuard();
  });

  const createMockContext = (
    method: string,
    roles: string[] = [],
    issuer = 'tenant',
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          user: {
            userId: 'u1',
            username: 'auditorUser',
            roles,
            issuer,
          },
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow GET requests for auditor role', () => {
    const context = createMockContext('GET', ['auditor']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow HEAD requests for auditor role', () => {
    const context = createMockContext('HEAD', ['auditor']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject POST, PUT, DELETE for auditor-only role', () => {
    const postContext = createMockContext('POST', ['auditor']);
    expect(() => guard.canActivate(postContext)).toThrow(ForbiddenException);

    const putContext = createMockContext('PUT', ['auditor']);
    expect(() => guard.canActivate(putContext)).toThrow(ForbiddenException);

    const deleteContext = createMockContext('DELETE', ['auditor']);
    expect(() => guard.canActivate(deleteContext)).toThrow(ForbiddenException);
  });

  it('should allow mutations if user also has admin role', () => {
    const context = createMockContext('POST', ['auditor', 'admin']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow if user is not an auditor', () => {
    const context = createMockContext('POST', ['maker']);
    expect(guard.canActivate(context)).toBe(true);
  });
});
