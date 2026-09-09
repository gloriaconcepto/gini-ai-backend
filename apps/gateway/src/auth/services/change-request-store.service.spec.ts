import { NotFoundException } from '@nestjs/common';
import { ChangeRequestStoreService } from './change-request-store.service';

describe('ChangeRequestStoreService', () => {
  let service: ChangeRequestStoreService;

  beforeEach(() => {
    service = new ChangeRequestStoreService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and store a pending change request with generated UUID and timestamps', () => {
      const request = service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: { username: 'testuser', email: 'test@example.com' },
        makerId: 'maker-1',
        makerUsername: 'maker@tenant.com',
      });

      expect(request).toBeDefined();
      expect(request.id).toBeDefined();
      expect(request.tenantId).toBe('tenant-1');
      expect(request.actionType).toBe('CREATE_USER');
      expect(request.status).toBe('PENDING');
      expect(request.makerId).toBe('maker-1');
      expect(request.makerUsername).toBe('maker@tenant.com');
      expect(request.createdAt).toBeInstanceOf(Date);
      expect(request.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('findAll', () => {
    it('should return all requests scoped strictly to the tenant', () => {
      service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: { username: 'u1' },
        makerId: 'm1',
        makerUsername: 'maker1',
      });
      service.create({
        tenantId: 'tenant-2',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: { username: 'u2' },
        makerId: 'm2',
        makerUsername: 'maker2',
      });
      service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_ROLE',
        targetResource: 'roles',
        payload: { name: 'reviewer' },
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      const tenant1Requests = service.findAll('tenant-1');
      expect(tenant1Requests.length).toBe(2);
      expect(tenant1Requests.every((r) => r.tenantId === 'tenant-1')).toBe(
        true,
      );

      const tenant2Requests = service.findAll('tenant-2');
      expect(tenant2Requests.length).toBe(1);
      expect(tenant2Requests[0].tenantId).toBe('tenant-2');
    });

    it('should filter requests by status when provided', () => {
      const r1 = service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });
      const r2 = service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_ROLE',
        targetResource: 'roles',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      service.update('tenant-1', r2.id, { status: 'APPROVED' });

      const pending = service.findAll('tenant-1', 'PENDING');
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(r1.id);

      const approved = service.findAll('tenant-1', 'APPROVED');
      expect(approved.length).toBe(1);
      expect(approved[0].id).toBe(r2.id);
    });
  });

  describe('findById', () => {
    it('should return request if exists and matches tenantId', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      const found = service.findById('tenant-1', created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined if request belongs to different tenant (strict tenant isolation)', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      const found = service.findById('tenant-2', created.id);
      expect(found).toBeUndefined();
    });

    it('should return undefined if request does not exist', () => {
      expect(service.findById('tenant-1', 'non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update request fields and set updatedAt', () => {
      const created = service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      const updated = service.update('tenant-1', created.id, {
        status: 'APPROVED',
        checkerId: 'checker-1',
        checkerUsername: 'checker1',
        reviewComment: 'LGTM',
      });

      expect(updated.status).toBe('APPROVED');
      expect(updated.checkerId).toBe('checker-1');
      expect(updated.checkerUsername).toBe('checker1');
      expect(updated.reviewComment).toBe('LGTM');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        created.createdAt.getTime(),
      );
    });

    it('should throw NotFoundException if request does not exist or belongs to another tenant', () => {
      expect(() =>
        service.update('tenant-1', 'unknown-id', { status: 'APPROVED' }),
      ).toThrow(NotFoundException);
    });
  });

  describe('clear', () => {
    it('should clear all stored requests', () => {
      service.create({
        tenantId: 'tenant-1',
        actionType: 'CREATE_USER',
        targetResource: 'users',
        payload: {},
        makerId: 'm1',
        makerUsername: 'maker1',
      });

      service.clear();
      expect(service.findAll('tenant-1').length).toBe(0);
    });
  });
});
