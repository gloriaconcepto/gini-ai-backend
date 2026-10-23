import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuditController } from './audit.controller';
import { AuditService } from '../services/audit.service';
import { AuditActionCategory, AuditStatus } from '../audit.types';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuditorGuard } from '../guards/auditor.guard';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: AuditService;

  const mockAuditService = {
    queryLogs: jest.fn(),
    getLogById: jest.fn(),
    getMetrics: jest.fn(),
    exportLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AuditorGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditController>(AuditController);
    auditService = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  const mockUserReq = (
    tenantId = 'tenant-test',
    issuer = 'http://keycloak/realms/tenant-test',
  ) =>
    ({
      user: {
        userId: 'u-1',
        username: 'auditor',
        tenantId,
        roles: ['auditor'],
        issuer,
      },
    }) as unknown as Request & { user?: AuthenticatedUser };

  it('should query logs scoped to caller tenantId', async () => {
    mockAuditService.queryLogs.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const req = mockUserReq('tenant-alpha');
    const result = await controller.getLogs({ page: 1, limit: 10 }, req);

    expect(auditService.queryLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-alpha',
        page: 1,
        limit: 10,
      }),
    );
    expect(result.total).toBe(0);
  });

  it('should allow master admin to query across all tenants', async () => {
    mockAuditService.queryLogs.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const masterReq = mockUserReq(undefined, 'http://keycloak/realms/master');
    await controller.getLogs({}, masterReq);

    expect(auditService.queryLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: undefined,
      }),
    );
  });

  it('should return summary metrics', async () => {
    const metrics = {
      totalEvents: 50,
      successCount: 45,
      failureCount: 5,
      categoryBreakdown: { IAM: 30, SYSTEM: 20 },
      statusBreakdown: { SUCCESS: 45, FAILURE: 5 },
      topActors: [{ actorId: 'u-1', count: 25 }],
    };
    mockAuditService.getMetrics.mockResolvedValue(metrics);

    const req = mockUserReq('tenant-beta');
    const result = await controller.getSummary(req);

    expect(auditService.getMetrics).toHaveBeenCalledWith('tenant-beta');
    expect(result).toEqual(metrics);
  });

  it('should get log by ID', async () => {
    const log = {
      id: 'log-100',
      timestamp: new Date().toISOString(),
      tenantId: 'tenant-gamma',
      traceId: 'tr-1',
      actor: { actorId: 'u-1', actorType: 'USER', roles: [] },
      category: AuditActionCategory.IAM,
      operation: 'TEST',
      httpMethod: 'POST',
      routePath: '/test',
      resourceType: 'test',
      statusCode: 200,
      durationMs: 10,
      status: AuditStatus.SUCCESS,
    };
    mockAuditService.getLogById.mockResolvedValue(log);

    const req = mockUserReq('tenant-gamma');
    const result = await controller.getLogById('log-100', req);

    expect(auditService.getLogById).toHaveBeenCalledWith(
      'log-100',
      'tenant-gamma',
    );
    expect(result.id).toBe('log-100');
  });

  it('should throw NotFoundException when log is not found', async () => {
    mockAuditService.getLogById.mockResolvedValue(null);

    const req = mockUserReq('tenant-gamma');
    await expect(controller.getLogById('non-existent', req)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should export logs as CSV', async () => {
    mockAuditService.exportLogs.mockResolvedValue('ID,Timestamp\n1,2026');

    const req = mockUserReq('tenant-csv');
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.exportLogs({ format: 'csv' }, req, res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.send).toHaveBeenCalledWith('ID,Timestamp\n1,2026');
  });

  it('should export logs as JSON', async () => {
    mockAuditService.exportLogs.mockResolvedValue('[]');

    const req = mockUserReq('tenant-json');
    const res = {
      setHeader: jest.fn(),
      send: jest.fn(),
    } as unknown as Response;

    await controller.exportLogs({ format: 'json' }, req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json',
    );
    expect(res.send).toHaveBeenCalledWith('[]');
  });
});
