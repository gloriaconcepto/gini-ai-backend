import {
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { MakerCheckerInterceptor } from './maker-checker.interceptor';
import { ChangeRequestStoreService } from '../services/change-request-store.service';
import { REQUIRE_DUAL_CONTROL_KEY } from '../decorators/require-dual-control.decorator';

describe('MakerCheckerInterceptor', () => {
  let interceptor: MakerCheckerInterceptor;
  let reflector: Reflector;
  let storeService: ChangeRequestStoreService;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockCallHandler: CallHandler = {
    handle: jest.fn().mockReturnValue(of({ success: true })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = mockReflector as unknown as Reflector;
    storeService = new ChangeRequestStoreService();
    interceptor = new MakerCheckerInterceptor(reflector, storeService);
  });

  const createMockContext = (req: any, res?: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () =>
          res || {
            status: jest.fn().mockReturnThis(),
          },
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  it('should pass through to next.handle() if route is not decorated with @RequireDualControl', (done) => {
    mockReflector.getAllAndOverride.mockReturnValueOnce(undefined);

    const context = createMockContext({});
    interceptor.intercept(context, mockCallHandler).subscribe((result) => {
      expect(result).toEqual({ success: true });
      expect(mockCallHandler.handle).toHaveBeenCalled();
      done();
    });
  });

  it('should throw ForbiddenException if user auth context or roles are missing', () => {
    mockReflector.getAllAndOverride.mockReturnValueOnce('CREATE_USER');

    const context = createMockContext({ user: null });
    expect(() => interceptor.intercept(context, mockCallHandler)).toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException if user lacks maker role', () => {
    mockReflector.getAllAndOverride.mockReturnValueOnce('CREATE_USER');

    const context = createMockContext({
      user: {
        userId: 'u1',
        username: 'checker@t.com',
        roles: ['checker', 'admin'],
        tenantId: 't-1',
      },
    });

    expect(() => interceptor.intercept(context, mockCallHandler)).toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException if tenantId is missing from user context', () => {
    mockReflector.getAllAndOverride.mockReturnValueOnce('CREATE_USER');

    const context = createMockContext({
      user: {
        userId: 'u1',
        username: 'maker@t.com',
        roles: ['maker'],
      },
    });

    expect(() => interceptor.intercept(context, mockCallHandler)).toThrow(
      ForbiddenException,
    );
  });

  it('should intercept maker request, create pending ChangeRequest, set 202 status, and return request', (done) => {
    mockReflector.getAllAndOverride.mockReturnValueOnce('CREATE_USER');

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
    };

    const mockRequest = {
      user: {
        userId: 'maker-123',
        username: 'maker@t.com',
        roles: ['maker', 'admin'],
        tenantId: 'tenant-abc',
      },
      params: {},
      query: {},
      body: { username: 'newuser', email: 'new@t.com' },
    };

    const context = createMockContext(mockRequest, mockResponse);

    interceptor.intercept(context, mockCallHandler).subscribe((result) => {
      expect(mockCallHandler.handle).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe('tenant-abc');
      expect(result.actionType).toBe('CREATE_USER');
      expect(result.status).toBe('PENDING');
      expect(result.targetResource).toBe('users');
      expect(result.payload.body).toEqual({
        username: 'newuser',
        email: 'new@t.com',
      });
      expect(result.makerId).toBe('maker-123');
      expect(result.makerUsername).toBe('maker@t.com');

      const saved = storeService.findById('tenant-abc', result.id);
      expect(saved).toBeDefined();
      expect(saved?.id).toBe(result.id);
      done();
    });
  });

  it('should correctly determine targetResource for role, client, idp, and fallback actions', (done) => {
    mockReflector.getAllAndOverride
      .mockReturnValueOnce('CREATE_ROLE')
      .mockReturnValueOnce('CREATE_CLIENT')
      .mockReturnValueOnce('CREATE_IDP')
      .mockReturnValueOnce('CUSTOM_ACTION' as any);

    const mockResponse = { status: jest.fn().mockReturnThis() };
    const mockRequest = (action: string, params: any) => ({
      user: {
        userId: 'maker-123',
        username: 'maker@t.com',
        roles: ['maker'],
        tenantId: 'tenant-abc',
      },
      params,
      query: {},
      body: {},
    });

    interceptor
      .intercept(
        createMockContext(
          mockRequest('CREATE_ROLE', { roleName: 'auditor' }),
          mockResponse,
        ),
        mockCallHandler,
      )
      .subscribe((r1) => {
        expect(r1.targetResource).toBe('roles');
        expect(r1.targetResourceId).toBe('auditor');

        interceptor
          .intercept(
            createMockContext(
              mockRequest('CREATE_CLIENT', { id: 'c1' }),
              mockResponse,
            ),
            mockCallHandler,
          )
          .subscribe((r2) => {
            expect(r2.targetResource).toBe('clients');
            expect(r2.targetResourceId).toBe('c1');

            interceptor
              .intercept(
                createMockContext(
                  mockRequest('CREATE_IDP', { alias: 'google' }),
                  mockResponse,
                ),
                mockCallHandler,
              )
              .subscribe((r3) => {
                expect(r3.targetResource).toBe('idp');
                expect(r3.targetResourceId).toBe('google');

                interceptor
                  .intercept(
                    createMockContext(
                      mockRequest('CUSTOM_ACTION', {}),
                      mockResponse,
                    ),
                    mockCallHandler,
                  )
                  .subscribe((r4) => {
                    expect(r4.targetResource).toBe('general');
                    done();
                  });
              });
          });
      });
  });
});
