import { Test, TestingModule } from '@nestjs/testing';
import { SystemController } from './system.controller';
import { KeycloakService } from '../services/keycloak.service';
import { TenantDomainService } from '../services/tenant-domain.service';
import { CreateTenantDto } from '../dto/create-tenant.dto';
import type { Response } from 'express';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());

describe('SystemController', () => {
  let controller: SystemController;
  let keycloakService: KeycloakService;

  const mockKeycloakService = {
    provisionTenantRealm: jest.fn(),
    listAllTenants: jest.fn(),
    getTenantDetails: jest.fn(),
    updateTenant: jest.fn(),
    setTenantStatus: jest.fn(),
    deleteTenant: jest.fn(),
  };

  const mockTenantDomainService = {
    registerDomain: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [
        {
          provide: KeycloakService,
          useValue: mockKeycloakService,
        },
        {
          provide: TenantDomainService,
          useValue: mockTenantDomainService,
        },
      ],
    }).compile();

    controller = module.get<SystemController>(SystemController);
    keycloakService = module.get<KeycloakService>(KeycloakService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTenant()', () => {
    it('should provision tenant realm, set X-Tenant-ID header, and return clean response payload with dual users', async () => {
      const mockResponseDto = {
        tenantId: 'uuid-1234',
        tenantName: 'Acme Corp',
        realm: 'tenant-uuid-1234',
        clientId: 'gini-frontend',
        maker: {
          id: 'maker-1234',
          email: 'maker@acme.com',
          username: 'maker@acme.com',
          firstName: 'John',
          lastName: 'Doe',
          roles: ['maker', 'admin'],
        },
        checker: {
          id: 'checker-5678',
          email: 'checker@acme.com',
          username: 'checker@acme.com',
          firstName: 'Jane',
          lastName: 'Smith',
          roles: ['checker', 'admin'],
        },
        enabled: true,
        roles: ['maker', 'checker', 'auditor', 'user', 'admin'],
        industry: 'FinTech',
        domainName: 'acme.com',
        subscriptionTier: 'Enterprise' as const,
        taxId: 'TX-9988',
        billingAddress: '100 Main St',
        contactPhone: '+1-555-1234',
        createdAt: '2026-09-01T15:00:00.000Z',
      };

      mockKeycloakService.provisionTenantRealm.mockResolvedValueOnce(
        mockResponseDto,
      );

      const body: CreateTenantDto = {
        tenantName: 'Acme Corp',
        makerEmail: 'maker@acme.com',
        makerPassword: 'SuperSecretPassword123!',
        makerFirstName: 'John',
        makerLastName: 'Doe',
        checkerEmail: 'checker@acme.com',
        checkerPassword: 'SuperSecretPassword456!',
        checkerFirstName: 'Jane',
        checkerLastName: 'Smith',
        industry: 'FinTech',
        domainName: 'acme.com',
        subscriptionTier: 'Enterprise',
        taxId: 'TX-9988',
        billingAddress: '100 Main St',
        contactPhone: '+1-555-1234',
        clientId: 'gini-frontend',
      };

      const setHeaderMock = jest.fn();
      const mockRes = {
        header: setHeaderMock,
      } as unknown as Response;

      const result = await controller.createTenant(body, mockRes);

      expect(mockKeycloakService.provisionTenantRealm).toHaveBeenCalledWith(
        expect.any(String),
        body.tenantName,
        {
          email: body.makerEmail,
          password: body.makerPassword,
          firstName: body.makerFirstName,
          lastName: body.makerLastName,
        },
        {
          email: body.checkerEmail,
          password: body.checkerPassword,
          firstName: body.checkerFirstName,
          lastName: body.checkerLastName,
        },
        {
          industry: 'FinTech',
          domainName: 'acme.com',
          subscriptionTier: 'Enterprise',
          taxId: 'TX-9988',
          billingAddress: '100 Main St',
          contactPhone: '+1-555-1234',
        },
        'gini-frontend',
      );

      expect(setHeaderMock).toHaveBeenCalledWith(
        'X-Tenant-ID',
        expect.any(String),
      );
      expect(mockTenantDomainService.registerDomain).toHaveBeenCalledWith(
        expect.any(String),
        body.tenantName,
        body.domainName,
        'gini-frontend',
      );
      expect(result).toEqual(mockResponseDto);
    });
  });

  describe('listTenants()', () => {
    it('should return all tenants from keycloakService', async () => {
      const mockTenants = [{ realm: 'tenant-1' }, { realm: 'tenant-2' }];
      mockKeycloakService.listAllTenants.mockResolvedValueOnce(mockTenants);

      const result = await controller.listTenants();
      expect(result).toEqual(mockTenants);
      expect(mockKeycloakService.listAllTenants).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTenant()', () => {
    it('should return specific tenant details', async () => {
      const mockTenant = { realm: 'tenant-1', displayName: 'Tenant 1' };
      mockKeycloakService.getTenantDetails.mockResolvedValueOnce(mockTenant);

      const result = await controller.getTenant('tenant-1');
      expect(result).toEqual(mockTenant);
      expect(mockKeycloakService.getTenantDetails).toHaveBeenCalledWith(
        'tenant-1',
      );
    });
  });

  describe('setTenantStatus()', () => {
    it('should update tenant enabled status', async () => {
      mockKeycloakService.setTenantStatus.mockResolvedValueOnce({
        success: true,
        enabled: false,
      });

      const result = await controller.setTenantStatus('tenant-1', {
        enabled: false,
      });
      expect(result).toEqual({ success: true, enabled: false });
      expect(mockKeycloakService.setTenantStatus).toHaveBeenCalledWith(
        'tenant-1',
        false,
      );
    });
  });

  describe('deleteTenant()', () => {
    it('should delete tenant realm', async () => {
      mockKeycloakService.deleteTenant.mockResolvedValueOnce({ success: true });

      const result = await controller.deleteTenant('tenant-1');
      expect(result).toEqual({ success: true });
      expect(mockKeycloakService.deleteTenant).toHaveBeenCalledWith('tenant-1');
    });
  });
});
