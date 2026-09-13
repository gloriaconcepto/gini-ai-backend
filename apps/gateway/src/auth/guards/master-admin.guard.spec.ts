import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { MasterAdminGuard } from './master-admin.guard';

describe('MasterAdminGuard', () => {
  let guard: MasterAdminGuard;

  beforeEach(() => {
    guard = new MasterAdminGuard();
  });

  const createMockContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should allow access if user is from master realm with admin role', () => {
    const context = createMockContext({
      userId: 'master-user-1',
      username: 'master-superadmin',
      roles: ['admin'],
      issuer: 'http://localhost:8080/realms/master',
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if user has realm-admin or manage-realm roles', () => {
    const context1 = createMockContext({
      userId: 'master-user-2',
      roles: ['realm-admin'],
      issuer: 'https://auth.gini.ai/realms/master',
    });
    expect(guard.canActivate(context1)).toBe(true);

    const context2 = createMockContext({
      userId: 'master-user-3',
      roles: ['manage-realm'],
      issuer: 'https://auth.gini.ai/realms/master',
    });
    expect(guard.canActivate(context2)).toBe(true);
  });

  it('should reject user with username admin if they lack master admin roles (backdoor closed)', () => {
    const context = createMockContext({
      userId: 'user-imposter',
      username: 'admin',
      roles: ['viewer'],
      issuer: 'http://localhost:8080/realms/master',
    });

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException(
        'Access denied: User does not have the admin role in the master realm',
      ),
    );
  });

  it('should reject user with admin role from non-master realm', () => {
    const context = createMockContext({
      userId: 'tenant-user-1',
      username: 'admin',
      roles: ['admin'],
      issuer: 'http://localhost:8080/realms/tenant-acme',
    });

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException(
        'Access denied: Requires Keycloak Master Realm administrator privileges',
      ),
    );
  });

  it('should reject request when user context is missing', () => {
    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('User context not found'),
    );
  });
});
