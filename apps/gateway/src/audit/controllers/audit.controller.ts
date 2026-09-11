import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuditorGuard } from '../guards/auditor.guard';
import { AuditService } from '../services/audit.service';
import {
  AuditExportQueryDto,
  AuditMetricsResponseDto,
  AuditPaginatedResponseDto,
  AuditQueryDto,
  AuditLogResponseDto,
} from '../dto/audit.dtos';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(RolesGuard, AuditorGuard)
@Roles('admin', 'auditor')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({
    summary: 'Query audit logs',
    description:
      'Retrieve paginated, filtered audit logs. Scoped strictly to the caller tenant realm unless invoked by OEM Master Admins.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit logs retrieved successfully',
    type: AuditPaginatedResponseDto,
  })
  async getLogs(
    @Query() query: AuditQueryDto,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<AuditPaginatedResponseDto> {
    const tenantId = this.resolveTenantScope(req);
    return this.auditService.queryLogs({
      ...query,
      tenantId,
    });
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get audit summary metrics',
    description:
      'Retrieve high-level audit metrics and activity breakdown for the tenant workspace.',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary metrics computed successfully',
    type: AuditMetricsResponseDto,
  })
  async getSummary(
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<AuditMetricsResponseDto> {
    const tenantId = this.resolveTenantScope(req);
    return this.auditService.getMetrics(tenantId);
  }

  @Get('logs/:id')
  @ApiOperation({
    summary: 'Get audit log details by ID',
    description:
      'Retrieve deep-dive information for a single audit log entry by UUID.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit log record details',
    type: AuditLogResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Audit log record not found or inaccessible',
  })
  async getLogById(
    @Param('id') id: string,
    @Req() req: Request & { user?: AuthenticatedUser },
  ): Promise<AuditLogResponseDto> {
    const tenantId = this.resolveTenantScope(req);
    const entry = await this.auditService.getLogById(id, tenantId);
    if (!entry) {
      throw new NotFoundException(`Audit log record with ID "${id}" not found`);
    }
    return entry;
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export audit logs',
    description:
      'Export filtered audit logs as downloadable CSV or JSON file stream.',
  })
  @ApiResponse({
    status: 200,
    description: 'Exported audit log data stream',
  })
  async exportLogs(
    @Query() query: AuditExportQueryDto,
    @Req() req: Request & { user?: AuthenticatedUser },
    @Res() res: Response,
  ): Promise<void> {
    const tenantId = this.resolveTenantScope(req);
    const format = query.format === 'csv' ? 'csv' : 'json';

    const output = await this.auditService.exportLogs(
      {
        ...query,
        tenantId,
      },
      format,
    );

    const filename = `audit-logs-${tenantId || 'global'}-${Date.now()}.${format}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
    }

    res.send(output);
  }

  /**
   * Resolves tenant scope. Master admin can view cross-tenant, while tenant users are restricted to their tenant.
   */
  private resolveTenantScope(
    req: Request & { user?: AuthenticatedUser },
  ): string | undefined {
    const user = req.user;
    const isMasterAdmin =
      user?.issuer?.endsWith('/realms/master') ||
      user?.issuer?.includes('/master');

    if (isMasterAdmin) {
      return undefined; // All tenants accessible
    }

    return user?.tenantId;
  }
}
