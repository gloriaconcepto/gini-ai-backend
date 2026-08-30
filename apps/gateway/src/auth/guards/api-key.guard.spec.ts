import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from '../services/api-key.service';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let service: ApiKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeyGuard, ApiKeyService],
    }).compile();

    guard = module.get<ApiKeyGuard>(ApiKeyGuard);
    service = module.get<ApiKeyService>(ApiKeyService);
  });

  it('should allow valid x-api-key header and populate request.user', async () => {
    const created = await service.generateApiKey(
      'tenant-100',
      'Agent Integration',
    );

    const mockRequest: any = {
      headers: {
        'x-api-key': created.apiKey,
      },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user.tenantId).toBe('tenant-100');
    expect(mockRequest.user.username).toBe('Agent Integration');
  });

  it('should throw UnauthorizedException when header is missing', async () => {
    const mockRequest: any = {
      headers: {},
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when API key is invalid', async () => {
    const mockRequest: any = {
      headers: {
        'x-api-key': 'gk_invalid',
      },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(mockContext)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
