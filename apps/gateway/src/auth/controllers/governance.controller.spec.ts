import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());
import { Test, TestingModule } from '@nestjs/testing';
import { GovernanceController } from './governance.controller';
import { ChangeRequestStoreService } from '../services/change-request-store.service';
import { ChangeRequestExecutorService } from '../services/change-request-executor.service';

describe('GovernanceController', () => {
  let controller: GovernanceController;
  let storeService: ChangeRequestStoreService;
  let executorService: ChangeRequestExecutorService;

  const mockExecutorService = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GovernanceController],
      providers: [
        ChangeRequestStoreService,
        {
          provide: ChangeRequestExecutorService,
          useValue: mockExecutorService,
        },
      ],
    }).compile();

    controller = module.get<GovernanceController>(GovernanceController);
    storeService = module.get<ChangeRequestStoreService>(
      ChangeRequestStoreService,
    );
    executorService = module.get<ChangeRequestExecutorService>(
      ChangeRequestExecutorService,
    );
  });

  const createAuthReq = (
    userId: string,
    username: string,
    roles: string[],
    tenantId: string = 'tenant-1',
  ) =>
    ({
      user: {
        userId,
        username,
        roles,
        tenantId,
      },
    }) as any;

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listRequests', () => {
    it('should return all change requests for the tenant', async () => {
      storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      const req = createAuthReq('c1', 'checker1', ['checker'], 'tenant-1');
      const result = await controller.listRequests(req, {});
      expect(result.length).toBe(1);
      expect(result[0].tenantId).toBe('tenant-1');
    });
  });

  describe('getRequest', () => {
    it('should return request if found for tenant', async () => {
      const created = storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      const req = createAuthReq('c1', 'checker1', ['checker'], 'tenant-1');
      const result = await controller.getRequest(req, created.id);
      expect(result.id).toBe(created.id);
    });

    it('should throw NotFoundException if request not found or belongs to different tenant', () => {
      const req = createAuthReq('c1', 'checker1', ['checker'], 'tenant-1');
      expect(() => controller.getRequest(req, 'non-existent')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('approveRequest', () => {
    it('should throw NotFoundException if request not found', async () => {
      const req = createAuthReq('c1', 'checker1', ['checker']);
      await expect(
        controller.approveRequest(req, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if maker attempts to approve their own request (dual-control violation)', async () => {
      const created = storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'user-same-id',
        makerUsername: 'maker1',
      });

      const req = createAuthReq('user-same-id', 'maker1', ['checker']);
      await expect(controller.approveRequest(req, created.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if request is not PENDING', async () => {
      const created = storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      storeService.update('tenant-1', created.id, { status: 'REJECTED' });

      const req = createAuthReq('c1', 'checker1', ['checker']);
      await expect(controller.approveRequest(req, created.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should approve, execute against Keycloak, and update status to APPROVED', async () => {
      const created = storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: { body: { username: 'john' } },
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      mockExecutorService.execute.mockResolvedValueOnce({
        id: 'keycloak-user-id',
      });

      const req = createAuthReq('c1', 'checker1', ['checker']);
      const result = await controller.approveRequest(req, created.id, {
        comment: 'Verified and approved',
      });

      expect(mockExecutorService.execute).toHaveBeenCalledWith(created);
      expect(result.status).toBe('APPROVED');
      expect(result.checkerId).toBe('c1');
      expect(result.checkerUsername).toBe('checker1');
      expect(result.reviewComment).toBe('Verified and approved');
      expect(result.executionResult).toEqual({ id: 'keycloak-user-id' });
      expect(result.executedAt).toBeDefined();
    });

    it('should record executionError and rethrow if executor fails', async () => {
      const created = storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      mockExecutorService.execute.mockRejectedValueOnce(
        new Error('Keycloak network failure'),
      );

      const req = createAuthReq('c1', 'checker1', ['checker']);
      await expect(controller.approveRequest(req, created.id)).rejects.toThrow(
        'Keycloak network failure',
      );

      const updated = storeService.findById('tenant-1', created.id);
      expect(updated?.executionError).toBe('Keycloak network failure');
    });
  });

  describe('rejectRequest', () => {
    it('should throw NotFoundException if request not found', () => {
      const req = createAuthReq('c1', 'checker1', ['checker']);
      expect(() =>
        controller.rejectRequest(req, 'non-existent', {
          comment: 'Invalid data',
        }),
      ).toThrow(NotFoundException);
    });

    it('should throw BadRequestException if request is not PENDING', () => {
      const created = storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      storeService.update('tenant-1', created.id, { status: 'APPROVED' });

      const req = createAuthReq('c1', 'checker1', ['checker']);
      expect(() =>
        controller.rejectRequest(req, created.id, {
          comment: 'Too late',
        }),
      ).toThrow(BadRequestException);
    });

    it('should reject pending request with comment and record checker identity', async () => {
      const created = storeService.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      const req = createAuthReq('c1', 'checker1', ['checker']);
      const result = await controller.rejectRequest(req, created.id, {
        comment: 'Invalid email domain provided',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.checkerId).toBe('c1');
      expect(result.checkerUsername).toBe('checker1');
      expect(result.reviewComment).toBe('Invalid email domain provided');
    });
  });
});
