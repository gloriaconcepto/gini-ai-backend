import { InMemoryAuditStorageAdapter } from './in-memory-audit-storage.adapter';
import {
  AuditActionCategory,
  AuditLogEntry,
  AuditStatus,
} from '../audit.types';

describe('InMemoryAuditStorageAdapter', () => {
  let adapter: InMemoryAuditStorageAdapter;

  const mockEntry = (overrides?: Partial<AuditLogEntry>): AuditLogEntry => ({
    id: 'log-1',
    timestamp: new Date().toISOString(),
    tenantId: 'tenant-alpha',
    traceId: 'trace-123',
    actor: {
      actorId: 'user-1',
      actorType: 'USER',
      username: 'john',
      roles: ['admin'],
    },
    category: AuditActionCategory.IAM,
    operation: 'CREATE_USER',
    httpMethod: 'POST',
    routePath: '/iam/users',
    resourceType: 'user',
    resourceId: 'target-user-1',
    statusCode: 201,
    durationMs: 45,
    status: AuditStatus.SUCCESS,
    ...overrides,
  });

  beforeEach(() => {
    adapter = new InMemoryAuditStorageAdapter(10);
  });

  it('should store and retrieve audit logs', async () => {
    const entry = mockEntry();
    await adapter.store(entry);

    const result = await adapter.findMany({});
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('log-1');
  });

  it('should enforce maxEntries limit by evicting oldest logs', async () => {
    const smallAdapter = new InMemoryAuditStorageAdapter(3);

    for (let i = 1; i <= 5; i++) {
      await smallAdapter.store(mockEntry({ id: `log-${i}` }));
    }

    const result = await smallAdapter.findMany({});
    expect(result.total).toBe(3);
    // Newest are log-5, log-4, log-3
    expect(result.items.map((e) => e.id)).toEqual(['log-5', 'log-4', 'log-3']);
  });

  it('should filter logs by tenantId, category, status, actorId, resourceType', async () => {
    await adapter.store(
      mockEntry({
        id: 'log-1',
        tenantId: 'tenant-1',
        category: AuditActionCategory.IAM,
        status: AuditStatus.SUCCESS,
      }),
    );
    await adapter.store(
      mockEntry({
        id: 'log-2',
        tenantId: 'tenant-2',
        category: AuditActionCategory.SYSTEM,
        status: AuditStatus.FAILURE,
      }),
    );

    const tenant1Logs = await adapter.findMany({ tenantId: 'tenant-1' });
    expect(tenant1Logs.total).toBe(1);
    expect(tenant1Logs.items[0].id).toBe('log-1');

    const systemLogs = await adapter.findMany({
      category: AuditActionCategory.SYSTEM,
    });
    expect(systemLogs.total).toBe(1);
    expect(systemLogs.items[0].id).toBe('log-2');
  });

  it('should filter logs by date range and search text', async () => {
    await adapter.store(
      mockEntry({
        id: 'log-old',
        timestamp: '2026-01-01T00:00:00.000Z',
        operation: 'OLD_OP',
      }),
    );
    await adapter.store(
      mockEntry({
        id: 'log-new',
        timestamp: '2026-06-01T00:00:00.000Z',
        operation: 'SPECIAL_SEARCH_OP',
      }),
    );

    const searchResult = await adapter.findMany({ search: 'SPECIAL_search' });
    expect(searchResult.total).toBe(1);
    expect(searchResult.items[0].id).toBe('log-new');

    const dateResult = await adapter.findMany({
      startDate: '2026-05-01T00:00:00.000Z',
    });
    expect(dateResult.total).toBe(1);
    expect(dateResult.items[0].id).toBe('log-new');
  });

  it('should paginate results correctly', async () => {
    for (let i = 1; i <= 5; i++) {
      await adapter.store(mockEntry({ id: `log-${i}` }));
    }

    const page1 = await adapter.findMany({ page: 1, limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.page).toBe(1);
    expect(page1.totalPages).toBe(3);

    const page2 = await adapter.findMany({ page: 2, limit: 2 });
    expect(page2.items.length).toBe(2);
    expect(page2.page).toBe(2);
  });

  it('should find log by id with tenant scoping', async () => {
    await adapter.store(mockEntry({ id: 'log-1', tenantId: 'tenant-a' }));

    const found = await adapter.findById('log-1', 'tenant-a');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('log-1');

    const notFoundOtherTenant = await adapter.findById('log-1', 'tenant-b');
    expect(notFoundOtherTenant).toBeNull();

    // Master realm can view across tenants
    const foundMaster = await adapter.findById('log-1', 'master');
    expect(foundMaster).not.toBeNull();
  });

  it('should compute audit metrics accurately', async () => {
    await adapter.store(
      mockEntry({
        tenantId: 'tenant-a',
        category: AuditActionCategory.IAM,
        status: AuditStatus.SUCCESS,
        actor: {
          actorId: 'user-1',
          actorType: 'USER',
          username: 'user1',
          roles: [],
        },
      }),
    );
    await adapter.store(
      mockEntry({
        tenantId: 'tenant-a',
        category: AuditActionCategory.IAM,
        status: AuditStatus.FAILURE,
        actor: {
          actorId: 'user-1',
          actorType: 'USER',
          username: 'user1',
          roles: [],
        },
      }),
    );
    await adapter.store(
      mockEntry({
        tenantId: 'tenant-b',
        category: AuditActionCategory.SYSTEM,
        status: AuditStatus.SUCCESS,
        actor: {
          actorId: 'user-2',
          actorType: 'USER',
          username: 'user2',
          roles: [],
        },
      }),
    );

    const metricsA = await adapter.getMetrics('tenant-a');
    expect(metricsA.totalEvents).toBe(2);
    expect(metricsA.successCount).toBe(1);
    expect(metricsA.failureCount).toBe(1);
    expect(metricsA.topActors[0].actorId).toBe('user-1');
    expect(metricsA.topActors[0].count).toBe(2);
  });

  it('should clear all stored logs when clear is called', async () => {
    await adapter.store(mockEntry({ id: 'log-to-clear' }));
    expect((await adapter.findMany({})).total).toBe(1);

    adapter.clear();
    expect((await adapter.findMany({})).total).toBe(0);
  });

  it('should return null when log does not exist', async () => {
    const result = await adapter.findById('does-not-exist');
    expect(result).toBeNull();
  });

  it('should filter out mismatched actorId, status, resourceType, and endDate', async () => {
    await adapter.store(
      mockEntry({
        id: 'entry-1',
        actor: { actorId: 'act-1', actorType: 'USER', roles: [] },
        status: AuditStatus.SUCCESS,
        resourceType: 'user',
        timestamp: '2026-06-01T00:00:00.000Z',
      }),
    );

    const actorMismatch = await adapter.findMany({ actorId: 'act-2' });
    expect(actorMismatch.total).toBe(0);

    const statusMismatch = await adapter.findMany({
      status: AuditStatus.FAILURE,
    });
    expect(statusMismatch.total).toBe(0);

    const resourceMismatch = await adapter.findMany({ resourceType: 'role' });
    expect(resourceMismatch.total).toBe(0);

    const endDateMismatch = await adapter.findMany({
      endDate: '2026-05-01T00:00:00.000Z',
    });
    expect(endDateMismatch.total).toBe(0);
  });
});
