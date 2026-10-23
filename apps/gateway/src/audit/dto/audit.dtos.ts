import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuditActionCategory, AuditStatus } from '../audit.types';

export class AuditQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by action category',
    enum: AuditActionCategory,
  })
  @IsOptional()
  @IsEnum(AuditActionCategory)
  category?: AuditActionCategory;

  @ApiPropertyOptional({
    description: 'Filter by audit execution status',
    enum: AuditStatus,
  })
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @ApiPropertyOptional({
    description: 'Filter by actor ID (user ID or API key ID)',
  })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by target resource type (e.g. user, role, api_key)',
  })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Start date in ISO format (inclusive)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date in ISO format (inclusive)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      'Full-text search keyword across routes, operations, actors, or resources',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number (1-indexed)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page (max 100)',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AuditExportQueryDto {
  @ApiPropertyOptional({
    description: 'Export file format',
    enum: ['json', 'csv'],
    default: 'json',
  })
  @IsOptional()
  @IsString()
  format?: 'json' | 'csv' = 'json';

  @ApiPropertyOptional({
    description: 'Filter by action category',
    enum: AuditActionCategory,
  })
  @IsOptional()
  @IsEnum(AuditActionCategory)
  category?: AuditActionCategory;

  @ApiPropertyOptional({
    description: 'Filter by audit execution status',
    enum: AuditStatus,
  })
  @IsOptional()
  @IsEnum(AuditStatus)
  status?: AuditStatus;

  @ApiPropertyOptional({ description: 'Filter by actor ID' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Start date in ISO format' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date in ISO format' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search keyword' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class AuditActorDto {
  @ApiProperty({
    description: 'Unique actor identifier (Keycloak sub or API Key ID)',
  })
  actorId!: string;

  @ApiProperty({
    description: 'Actor classification',
    enum: ['USER', 'API_KEY', 'SYSTEM', 'ANONYMOUS'],
  })
  actorType!: 'USER' | 'API_KEY' | 'SYSTEM' | 'ANONYMOUS';

  @ApiPropertyOptional({ description: 'Actor username if available' })
  username?: string;

  @ApiPropertyOptional({ description: 'Actor email address if available' })
  email?: string;

  @ApiPropertyOptional({ description: 'Actor tenant realm ID' })
  tenantId?: string;

  @ApiProperty({
    description: 'Assigned roles to actor at execution time',
    type: [String],
  })
  roles!: string[];

  @ApiPropertyOptional({ description: 'Client IP address' })
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'Client User-Agent header' })
  userAgent?: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ description: 'Unique audit log UUID' })
  id!: string;

  @ApiProperty({ description: 'ISO 8601 UTC timestamp of the audited action' })
  timestamp!: string;

  @ApiProperty({ description: 'Tenant realm identifier' })
  tenantId!: string;

  @ApiProperty({ description: 'Trace or request correlation ID' })
  traceId!: string;

  @ApiProperty({
    description: 'Actor who triggered the action',
    type: AuditActorDto,
  })
  actor!: AuditActorDto;

  @ApiProperty({
    description: 'High-level action domain category',
    enum: AuditActionCategory,
  })
  category!: AuditActionCategory;

  @ApiProperty({ description: 'Human-readable action name' })
  operation!: string;

  @ApiProperty({ description: 'HTTP method used' })
  httpMethod!: string;

  @ApiProperty({ description: 'HTTP endpoint path' })
  routePath!: string;

  @ApiProperty({ description: 'Target resource entity type' })
  resourceType!: string;

  @ApiPropertyOptional({
    description: 'Target resource identifier if applicable',
  })
  resourceId?: string;

  @ApiProperty({ description: 'HTTP status code result' })
  statusCode!: number;

  @ApiProperty({ description: 'Execution duration in milliseconds' })
  durationMs!: number;

  @ApiProperty({ description: 'Final audit status', enum: AuditStatus })
  status!: AuditStatus;

  @ApiPropertyOptional({
    description: 'Sanitized request body payload (sensitive fields redacted)',
    type: Object,
  })
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Additional contextual metadata (sanitized)',
    type: Object,
  })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Error message if action failed' })
  errorMessage?: string;
}

export class AuditPaginatedResponseDto {
  @ApiProperty({
    description: 'List of audit log records',
    type: [AuditLogResponseDto],
  })
  items!: AuditLogResponseDto[];

  @ApiProperty({ description: 'Total number of matching audit logs' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Page size limit' })
  limit!: number;

  @ApiProperty({ description: 'Total available pages' })
  totalPages!: number;
}

export class TopActorMetricDto {
  @ApiProperty({ description: 'Actor identifier' })
  actorId!: string;

  @ApiPropertyOptional({ description: 'Actor username' })
  username?: string;

  @ApiProperty({ description: 'Number of recorded actions' })
  count!: number;
}

export class AuditMetricsResponseDto {
  @ApiProperty({ description: 'Total audited events for tenant' })
  totalEvents!: number;

  @ApiProperty({ description: 'Count of successful actions' })
  successCount!: number;

  @ApiProperty({ description: 'Count of failed/denied actions' })
  failureCount!: number;

  @ApiProperty({ description: 'Counts aggregated by category', type: Object })
  categoryBreakdown!: Record<string, number>;

  @ApiProperty({ description: 'Counts aggregated by status', type: Object })
  statusBreakdown!: Record<string, number>;

  @ApiProperty({ description: 'Top active actors', type: [TopActorMetricDto] })
  topActors!: TopActorMetricDto[];
}
