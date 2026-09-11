import { AuditMaskingService } from './audit-masking.service';

describe('AuditMaskingService', () => {
  let service: AuditMaskingService;

  beforeEach(() => {
    service = new AuditMaskingService();
  });

  it('should return null or undefined as is', () => {
    expect(service.mask(null)).toBeNull();
    expect(service.mask(undefined)).toBeUndefined();
  });

  it('should mask known sensitive keys in objects', () => {
    const input = {
      username: 'john_doe',
      password: 'superSecretPassword123!',
      clientSecret: 'secret_val',
      apiKey: 'xyz-api-key',
      metadata: {
        adminPassword: 'root',
        taxId: '12-3456789',
        normalInfo: 'visible',
      },
    };

    const masked = service.mask(input);

    expect(masked.username).toBe('john_doe');
    expect(masked.password).toBe('[REDACTED]');
    expect(masked.clientSecret).toBe('[REDACTED]');
    expect(masked.apiKey).toBe('[REDACTED]');
    expect(masked.metadata.adminPassword).toBe('[REDACTED]');
    expect(masked.metadata.taxId).toBe('[REDACTED]');
    expect(masked.metadata.normalInfo).toBe('visible');
  });

  it('should support custom sensitive keys', () => {
    const input = {
      accountNumber: '123456789',
      routingNumber: '987654321',
      publicInfo: 'open',
    };

    const masked = service.mask(input, ['accountNumber', 'routingNumber']);

    expect(masked.accountNumber).toBe('[REDACTED]');
    expect(masked.routingNumber).toBe('[REDACTED]');
    expect(masked.publicInfo).toBe('open');
  });

  it('should mask array elements recursively', () => {
    const input = [
      { email: 'user1@test.com', password: 'pwd' },
      { email: 'user2@test.com', secret: 'sec' },
    ];

    const masked = service.mask(input);

    expect(masked[0].password).toBe('[REDACTED]');
    expect(masked[1].secret).toBe('[REDACTED]');
    expect(masked[0].email).toBe('user1@test.com');
  });

  it('should mask bearer tokens and JWT strings embedded in values', () => {
    const input = {
      header:
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakSignature',
      message: 'Card 4532-1234-5678-9012 was charged',
    };

    const masked = service.mask(input);

    expect(masked.header).toContain('[REDACTED');
    expect(masked.message).toContain('[REDACTED_CARD]');
  });

  it('should safely handle circular references', () => {
    const circularObj: Record<string, unknown> = { name: 'test' };
    circularObj.self = circularObj;

    const masked = service.mask(circularObj);
    expect(masked.name).toBe('test');
    expect(masked.self).toBe('[CIRCULAR]');
  });
});
