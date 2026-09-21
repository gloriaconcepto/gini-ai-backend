import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  AuditFilter,
  AuditLogEntry,
  AuditMetrics,
  PaginatedAuditLogs,
} from '../audit.types';
import { InMemoryAuditStorageAdapter } from '../adapters/in-memory-audit-storage.adapter';
import { AuditMaskingService } from './audit-masking.service';
import { AUDIT_CONFIG } from '../constants/audit.constants';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly storageAdapter: InMemoryAuditStorageAdapter,
    private readonly maskingService: AuditMaskingService,
  ) {}

  /**
   * Records an audit log entry safely without blocking or disrupting the caller.
   */
  async recordLog(
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & {
      id?: string;
      timestamp?: string;
    },
  ): Promise<void> {
    try {
      const fullEntry: AuditLogEntry = {
        ...entry,
        id: entry.id || randomUUID(),
        timestamp: entry.timestamp || new Date().toISOString(),
        payload: entry.payload
          ? this.maskingService.mask(entry.payload)
          : undefined,
        metadata: entry.metadata
          ? this.maskingService.mask(entry.metadata)
          : undefined,
      };

      await this.storageAdapter.store(fullEntry);
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Queries audit logs with pagination, filtering, and sensitive data masking.
   */
  async queryLogs(filter: AuditFilter): Promise<PaginatedAuditLogs> {
    const result = await this.storageAdapter.findMany(filter);
    const sanitizedItems = result.items.map((item) => ({
      ...item,
      payload: item.payload
        ? this.maskingService.mask(item.payload)
        : undefined,
      metadata: item.metadata
        ? this.maskingService.mask(item.metadata)
        : undefined,
    }));

    return {
      ...result,
      items: sanitizedItems,
    };
  }

  /**
   * Retrieves an individual audit log by ID.
   */
  async getLogById(
    id: string,
    tenantId?: string,
  ): Promise<AuditLogEntry | null> {
    const entry = await this.storageAdapter.findById(id, tenantId);
    if (!entry) {
      return null;
    }

    return {
      ...entry,
      payload: entry.payload
        ? this.maskingService.mask(entry.payload)
        : undefined,
      metadata: entry.metadata
        ? this.maskingService.mask(entry.metadata)
        : undefined,
    };
  }

  /**
   * Computes audit metrics and breakdowns for a tenant or platform wide.
   */
  async getMetrics(tenantId?: string): Promise<AuditMetrics> {
    return this.storageAdapter.getMetrics(tenantId);
  }

  /**
   * Exports audit logs in JSON or CSV format.
   */
  async exportLogs(
    filter: AuditFilter,
    format: 'json' | 'csv' = 'json',
  ): Promise<string> {
    // Export up to DEFAULT_EXPORT_LIMIT logs matching the filter
    const exportFilter: AuditFilter = {
      ...filter,
      page: AUDIT_CONFIG.DEFAULT_PAGE,
      limit: AUDIT_CONFIG.DEFAULT_EXPORT_LIMIT,
    };

    const paginated = await this.queryLogs(exportFilter);

    if (format === 'csv') {
      return this.convertToCsv(paginated.items);
    }

    return JSON.stringify(paginated.items, null, 2);
  }

  private convertToCsv(items: AuditLogEntry[]): string {
    const headers = [
      'ID',
      'Timestamp',
      'TenantID',
      'TraceID',
      'ActorID',
      'ActorType',
      'ActorUsername',
      'Category',
      'Operation',
      'Method',
      'RoutePath',
      'ResourceType',
      'ResourceID',
      'StatusCode',
      'DurationMs',
      'Status',
    ];

    const escapeCsvField = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }
      if (typeof val === 'number' || typeof val === 'boolean') {
        return val.toString();
      }
      const str = JSON.stringify(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = items.map((item) =>
      [
        escapeCsvField(item.id),
        escapeCsvField(item.timestamp),
        escapeCsvField(item.tenantId),
        escapeCsvField(item.traceId),
        escapeCsvField(item.actor.actorId),
        escapeCsvField(item.actor.actorType),
        escapeCsvField(item.actor.username),
        escapeCsvField(item.category),
        escapeCsvField(item.operation),
        escapeCsvField(item.httpMethod),
        escapeCsvField(item.routePath),
        escapeCsvField(item.resourceType),
        escapeCsvField(item.resourceId),
        escapeCsvField(item.statusCode),
        escapeCsvField(item.durationMs),
        escapeCsvField(item.status),
      ].join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }
}
