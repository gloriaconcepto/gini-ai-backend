export enum AuditActionCategory {
  IAM = 'IAM',
  SYSTEM = 'SYSTEM',
  GOVERNANCE = 'GOVERNANCE',
  API_KEY = 'API_KEY',
  AUTH = 'AUTH',
  DATA_ACCESS = 'DATA_ACCESS',
  SYSTEM_CONFIG = 'SYSTEM_CONFIG',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  DENIED = 'DENIED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export interface AuditActor {
  actorId: string;
  actorType: 'USER' | 'API_KEY' | 'SYSTEM' | 'ANONYMOUS';
  username?: string;
  email?: string;
  tenantId?: string;
  roles: string[];
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  tenantId: string;
  traceId: string;
  actor: AuditActor;
  category: AuditActionCategory;
  operation: string;
  httpMethod: string;
  routePath: string;
  resourceType: string;
  resourceId?: string;
  statusCode: number;
  durationMs: number;
  status: AuditStatus;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

export interface AuditFilter {
  tenantId?: string;
  actorId?: string;
  category?: AuditActionCategory;
  status?: AuditStatus;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditMetrics {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  categoryBreakdown: Record<string, number>;
  statusBreakdown: Record<string, number>;
  topActors: { actorId: string; username?: string; count: number }[];
}

export interface IAuditStorageAdapter {
  store(entry: AuditLogEntry): Promise<void>;
  findMany(filter: AuditFilter): Promise<PaginatedAuditLogs>;
  findById(id: string, tenantId?: string): Promise<AuditLogEntry | null>;
  getMetrics(tenantId?: string): Promise<AuditMetrics>;
}

export interface AuditDecoratorOptions {
  category?: AuditActionCategory;
  operation?: string;
  resourceType?: string;
  extractResourceId?: (req: any) => string | undefined;
  maskFields?: string[];
}
