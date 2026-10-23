import { AuditService } from './audit.service';
import { InMemoryAuditStorageAdapter } from '../adapters/in-memory-audit-storage.adapter';
import { AuditMaskingService } from './audit-masking.service';
import {
  AuditActionCategory,
  AuditLogEntry,
  AuditStatus,
} from '../audit.types';

describe('AuditService', () => {
  let service: AuditService;
  let adapter: InMemoryAuditStorageAdapter;
  let maskingService: AuditMaskingService;

  beforeEach(() => {
    maskingService = new AuditMaskingService();
    adapter = new InMemoryAuditStorageAdapter(100);
    service = new AuditService(adapter, maskingService);
  });

  it('should record an audit log with automatic ID, timestamp and masked payload', async () => {
    await service.recordLog({
      tenantId: 'tenant-test',
      traceId: 'trace-1',
      actor: {
        actorId: 'user-123',
        actorType: 'USER',
        roles: ['maker'],
      },
      category: AuditActionCategory.IAM,
      operation: 'CREATE_USER',
      httpMethod: 'POST',
      routePath: '/iam/users',
      resourceType: 'user',
      statusCode: 201,
      durationMs: 30,
      status: AuditStatus.SUCCESS,
      payload: {
        username: 'alice',
        password: 'SuperSecretPassword!',
      },
    });

    const logs = await service.queryLogs({ tenantId: 'tenant-test' });
    expect(logs.total).toBe(1);
    expect(logs.items[0].id).toBeDefined();
    expect(logs.items[0].timestamp).toBeDefined();
    expect(logs.items[0].payload?.username).toBe('alice');
    expect(logs.items[0].payload?.password).toBe('[REDACTED]');
  });

  it('should be fail-safe and not throw when storage throws', async () => {
    jest
      .spyOn(adapter, 'store')
      .mockRejectedValueOnce(new Error('Storage failure'));

    await expect(
      service.recordLog({
        tenantId: 'tenant-test',
        traceId: 'trace-1',
        actor: {
          actorId: 'user-123',
          actorType: 'USER',
          roles: [],
        },
        category: AuditActionCategory.IAM,
        operation: 'FAIL_TEST',
        httpMethod: 'POST',
        routePath: '/iam/fail',
        resourceType: 'user',
        statusCode: 500,
        durationMs: 10,
        status: AuditStatus.FAILURE,
      }),
    ).resolves.not.toThrow();
  });

  it('should query and return masked logs', async () => {
    await service.recordLog({
      tenantId: 'tenant-1',
      traceId: 'trace-2',
      actor: {
        actorId: 'user-456',
        actorType: 'USER',
        roles: ['admin'],
      },
      category: AuditActionCategory.API_KEY,
      operation: 'CREATE_API_KEY',
      httpMethod: 'POST',
      routePath: '/api-keys',
      resourceType: 'api_key',
      statusCode: 201,
      durationMs: 15,
      status: AuditStatus.SUCCESS,
      payload: { apiKey: 'raw_api_key_secret' },
    });

    const result = await service.queryLogs({ tenantId: 'tenant-1' });
    expect(result.total).toBe(1);
    expect(result.items[0].payload?.apiKey).toBe('[REDACTED]');
  });

  it('should get log by ID', async () => {
    const rawEntry: AuditLogEntry = {
      id: 'custom-id-999',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-1',
      traceId: 'trace-999',
      actor: { actorId: 'u1', actorType: 'USER', roles: [] },
      category: AuditActionCategory.SYSTEM,
      operation: 'VIEW',
      httpMethod: 'GET',
      routePath: '/system',
      resourceType: 'system',
      statusCode: 200,
      durationMs: 5,
      status: AuditStatus.SUCCESS,
    };
    await adapter.store(rawEntry);

    const found = await service.getLogById('custom-id-999', 'tenant-1');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('custom-id-999');

    const notFound = await service.getLogById('non-existent');
    expect(notFound).toBeNull();
  });

  it('should export logs in JSON and CSV formats', async () => {
    await service.recordLog({
      tenantId: 'tenant-export',
      traceId: 'trace-exp',
      actor: {
        actorId: 'actor-exp',
        actorType: 'USER',
        username: 'exporter, user',
        roles: [],
      },
      category: AuditActionCategory.IAM,
      operation: 'EXPORT_TEST',
      httpMethod: 'GET',
      routePath: '/export',
      resourceType: 'data',
      statusCode: 200,
      durationMs: 25,
      status: AuditStatus.SUCCESS,
    });

    const jsonExport = await service.exportLogs(
      { tenantId: 'tenant-export' },
      'json',
    );
    expect(jsonExport).toContain('EXPORT_TEST');
    const parsed = JSON.parse(jsonExport) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);

    const csvExport = await service.exportLogs(
      { tenantId: 'tenant-export' },
      'csv',
    );
    expect(csvExport).toContain('ID,Timestamp,TenantID,TraceID');
    expect(csvExport).toContain('"exporter, user"');
    expect(csvExport).toContain('EXPORT_TEST');
  });

  it('should forward metrics from storage adapter', async () => {
    const metrics = await service.getMetrics('tenant-1');
    expect(metrics.totalEvents).toBe(0);
    expect(metrics.successCount).toBe(0);
  });
});
