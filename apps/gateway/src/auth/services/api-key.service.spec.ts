import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyService } from './api-key.service';
import { NotFoundException } from '@nestjs/common';

describe('ApiKeyService', () => {
  let service: ApiKeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeyService],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate an API key with prefix and secret', async () => {
    const result = await service.generateApiKey('tenant-1', 'Test Key');
    expect(result.id).toBeDefined();
    expect(result.name).toBe('Test Key');
    expect(result.apiKey).toMatch(/^gk_[a-f0-9]{48}$/);
    expect(result.keyPrefix).toBe(result.apiKey.substring(0, 7));
  });

  it('should validate an active API key', async () => {
    const created = await service.generateApiKey('tenant-1', 'Test Key');
    const validation = await service.validateApiKey(created.apiKey);
    expect(validation.valid).toBe(true);
    expect(validation.record?.tenantId).toBe('tenant-1');
  });

  it('should reject an invalid or unknown API key', async () => {
    const validation = await service.validateApiKey(
      'gk_invalidkey123456789012345678901234567890',
    );
    expect(validation.valid).toBe(false);
  });

  it('should list API keys for a specific tenant without raw secret', async () => {
    await service.generateApiKey('tenant-1', 'Key 1');
    await service.generateApiKey('tenant-1', 'Key 2');
    await service.generateApiKey('tenant-2', 'Key 3');

    const keysTenant1 = await service.listApiKeys('tenant-1');
    expect(keysTenant1.length).toBe(2);
    expect((keysTenant1[0] as any).hashedKey).toBeUndefined();
  });

  it('should revoke an API key and fail subsequent validation', async () => {
    const created = await service.generateApiKey('tenant-1', 'Revokable Key');
    await service.revokeApiKey('tenant-1', created.id);

    const validation = await service.validateApiKey(created.apiKey);
    expect(validation.valid).toBe(false);
  });

  it('should throw NotFoundException when revoking non-existent API key', async () => {
    await expect(
      service.revokeApiKey('tenant-1', 'non-existent-id'),
    ).rejects.toThrow(NotFoundException);
  });
});
