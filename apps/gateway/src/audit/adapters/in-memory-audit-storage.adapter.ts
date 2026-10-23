import { Injectable, Optional } from '@nestjs/common';
import {
  AuditFilter,
  AuditLogEntry,
  AuditMetrics,
  AuditStatus,
  IAuditStorageAdapter,
  PaginatedAuditLogs,
} from '../audit.types';

@Injectable()
export class InMemoryAuditStorageAdapter implements IAuditStorageAdapter {
  private logs: AuditLogEntry[] = [];
  private readonly maxEntries: number;

  constructor(@Optional() maxEntries?: number) {
    this.maxEntries = maxEntries ?? 50000;
  }

  async store(entry: AuditLogEntry): Promise<void> {
    if (this.logs.length >= this.maxEntries) {
      this.logs.pop(); // Remove oldest entry
    }
    // Newest entries at the front
    this.logs.unshift(entry);
  }

  async findMany(filter: AuditFilter): Promise<PaginatedAuditLogs> {
    const {
      tenantId,
      actorId,
      category,
      status,
      resourceType,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = filter;

    const filtered = this.logs.filter((log) => {
      if (tenantId && log.tenantId !== tenantId) {
        return false;
      }
      if (actorId && log.actor.actorId !== actorId) {
        return false;
      }
      if (category && log.category !== category) {
        return false;
      }
      if (status && log.status !== status) {
        return false;
      }
      if (resourceType && log.resourceType !== resourceType) {
        return false;
      }
      if (startDate && new Date(log.timestamp) < new Date(startDate)) {
        return false;
      }
      if (endDate && new Date(log.timestamp) > new Date(endDate)) {
        return false;
      }
      if (search) {
        const query = search.toLowerCase();
        const matchesOperation = log.operation.toLowerCase().includes(query);
        const matchesRoute = log.routePath.toLowerCase().includes(query);
        const matchesActor =
          log.actor.username?.toLowerCase().includes(query) ||
          log.actor.actorId.toLowerCase().includes(query);
        const matchesResource = log.resourceId?.toLowerCase().includes(query);

        if (
          !matchesOperation &&
          !matchesRoute &&
          !matchesActor &&
          !matchesResource
        ) {
          return false;
        }
      }
      return true;
    });

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const total = filtered.length;
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const startIndex = (safePage - 1) * safeLimit;
    const items = filtered.slice(startIndex, startIndex + safeLimit);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    };
  }

  async findById(id: string, tenantId?: string): Promise<AuditLogEntry | null> {
    const entry = this.logs.find((log) => log.id === id);
    if (!entry) {
      return null;
    }
    if (tenantId && tenantId !== 'master' && entry.tenantId !== tenantId) {
      return null;
    }
    return entry;
  }

  async getMetrics(tenantId?: string): Promise<AuditMetrics> {
    const tenantLogs = tenantId
      ? this.logs.filter((log) => log.tenantId === tenantId)
      : this.logs;

    let successCount = 0;
    let failureCount = 0;
    const categoryBreakdown: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};
    const actorCounts = new Map<
      string,
      { actorId: string; username?: string; count: number }
    >();

    for (const log of tenantLogs) {
      if (log.status === AuditStatus.SUCCESS) {
        successCount++;
      } else {
        failureCount++;
      }

      categoryBreakdown[log.category] =
        (categoryBreakdown[log.category] || 0) + 1;
      statusBreakdown[log.status] = (statusBreakdown[log.status] || 0) + 1;

      const actorKey = log.actor.actorId;
      const current = actorCounts.get(actorKey) || {
        actorId: actorKey,
        username: log.actor.username,
        count: 0,
      };
      current.count++;
      actorCounts.set(actorKey, current);
    }

    const topActors = Array.from(actorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEvents: tenantLogs.length,
      successCount,
      failureCount,
      categoryBreakdown,
      statusBreakdown,
      topActors,
    };
  }

  /**
   * Helper to clear logs (useful for testing)
   */
  clear(): void {
    this.logs = [];
  }
}
