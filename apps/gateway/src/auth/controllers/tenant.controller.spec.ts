import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { KeycloakService } from '../services/keycloak.service';
import { TenantDomainService } from '../services/tenant-domain.service';
import { AuthenticatedUser } from '../strategies/jwt.strategy';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());

describe('TenantController', () => {
  let controller: TenantController;
  let mockKeycloakService: {
    getTenantDetails: jest.Mock;
  };
  let mockTenantDomainService: {
    resolveDomain: jest.Mock;
  };

  beforeEach(async () => {
    mockKeycloakService = {
      getTenantDetails: jest.fn(),
    };
    mockTenantDomainService = {
      resolveDomain: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantController],
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

    controller = module.get<TenantController>(TenantController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getWorkspace()', () => {
    it('should successfully return tenant workspace details for a regular tenant user', async () => {
      const tenantId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
      const user: AuthenticatedUser = {
        userId: 'user-regular-123',
        username: 'regular@acme.com',
        tenantId,
        roles: ['user'],
        issuer: `http://localhost:8080/realms/tenant-${tenantId}`,
      };

      const mockRealm = {
        id: 'realm-id-123',
        realm: `tenant-${tenantId}`,
        displayName: 'Acme Corporation',
        enabled: true,
        loginTheme: 'gini-theme',
        accountTheme: 'gini-theme',
        adminTheme: 'gini-theme',
        emailTheme: 'gini-theme',
        attributes: {
          industry: 'Finance',
          domainName: 'acme.com',
          subscriptionTier: 'Enterprise',
          taxId: '12-3456789',
          billingAddress: '123 Main St, USA',
          contactPhone: '+1-555-0198',
        },
      };

      mockKeycloakService.getTenantDetails.mockResolvedValueOnce(mockRealm);

      const result = await controller.getWorkspace({ user } as any);

      expect(mockKeycloakService.getTenantDetails).toHaveBeenCalledWith(
        tenantId,
      );
      expect(result).toEqual({
        tenantId,
        tenantName: 'Acme Corporation',
        realm: `tenant-${tenantId}`,
        enabled: true,
        loginTheme: 'gini-theme',
        accountTheme: 'gini-theme',
        adminTheme: 'gini-theme',
        emailTheme: 'gini-theme',
        industry: 'Finance',
        domainName: 'acme.com',
        subscriptionTier: 'Enterprise',
        taxId: '12-3456789',
        billingAddress: '123 Main St, USA',
        contactPhone: '+1-555-0198',
        attributes: mockRealm.attributes,
        currentUser: {
          userId: 'user-regular-123',
          username: 'regular@acme.com',
          roles: ['user'],
        },
      });
    });

    it('should successfully return tenant workspace details for a tenant admin', async () => {
      const tenantId = 'tenant-admin-uuid';
      const user: AuthenticatedUser = {
        userId: 'maker-456',
        username: 'maker@acme.com',
        tenantId,
        roles: ['maker', 'admin'],
        issuer: `http://localhost:8080/realms/tenant-${tenantId}`,
      };

      const mockRealm = {
        id: 'realm-id-admin',
        realm: `tenant-${tenantId}`,
        displayName: 'Acme Admin Corp',
        enabled: true,
        loginTheme: 'gini-theme',
        attributes: {
          industry: ['Healthcare'], // Array attribute test
          domainName: 'healthcare.acme.com',
        },
      };

      mockKeycloakService.getTenantDetails.mockResolvedValueOnce(mockRealm);

      const result = await controller.getWorkspace({ user } as any);

      expect(mockKeycloakService.getTenantDetails).toHaveBeenCalledWith(
        tenantId,
      );
      expect(result.industry).toBe('Healthcare');
      expect(result.domainName).toBe('healthcare.acme.com');
      expect(result.currentUser.roles).toEqual(['maker', 'admin']);
    });

    it('should throw ForbiddenException if user has no tenantId (OEM/Master admin)', async () => {
      const oemAdminUser: AuthenticatedUser = {
        userId: 'oem-master-admin-id',
        username: 'master-admin',
        tenantId: undefined, // Master realm user has no tenantId
        roles: ['admin'],
        issuer: 'http://localhost:8080/realms/master',
      };

      await expect(
        controller.getWorkspace({ user: oemAdminUser } as any),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        controller.getWorkspace({ user: oemAdminUser } as any),
      ).rejects.toThrow(
        'Master administrators do not belong to a tenant workspace',
      );

      expect(mockKeycloakService.getTenantDetails).not.toHaveBeenCalled();
    });

    it('should propagate NotFoundException if KeycloakService does not find the realm', async () => {
      const tenantId = 'non-existent-tenant';
      const user: AuthenticatedUser = {
        userId: 'some-user-id',
        username: 'user@nowhere.com',
        tenantId,
        roles: ['user'],
        issuer: `http://localhost:8080/realms/tenant-${tenantId}`,
      };

      mockKeycloakService.getTenantDetails.mockRejectedValueOnce(
        new NotFoundException(`Tenant realm tenant-${tenantId} not found`),
      );

      await expect(controller.getWorkspace({ user } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resolveTenant()', () => {
    it('should call tenantDomainService.resolveDomain with query.domain and return resolution data', async () => {
      const mockResult = {
        tenantId: 'resolved-tenant-id',
        tenantName: 'Resolved Corp',
        realm: 'tenant-resolved-tenant-id',
        clientId: 'gini-frontend',
        keycloakUrl:
          'http://localhost:8080/realms/tenant-resolved-tenant-id',
        loginTheme: 'gini-theme',
      };

      mockTenantDomainService.resolveDomain.mockResolvedValueOnce(mockResult);

      const result = await controller.resolveTenant({ domain: 'acme.com' });

      expect(mockTenantDomainService.resolveDomain).toHaveBeenCalledWith(
        'acme.com',
      );
      expect(result).toEqual(mockResult);
    });

    it('should propagate NotFoundException if domain is not found', async () => {
      mockTenantDomainService.resolveDomain.mockRejectedValueOnce(
        new NotFoundException("Tenant workspace for domain 'unknown.com' not found"),
      );

      await expect(
        controller.resolveTenant({ domain: 'unknown.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
