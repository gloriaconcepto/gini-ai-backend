import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { TenantDomainService } from './tenant-domain.service';
import { KeycloakService } from './keycloak.service';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());

describe('TenantDomainService', () => {
  let service: TenantDomainService;
  let mockKeycloakService: {
    listAllTenants: jest.Mock;
  };
  let mockConfigService: {
    get: jest.Mock;
  };

  beforeEach(async () => {
    mockKeycloakService = {
      listAllTenants: jest.fn(),
    };
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'KEYCLOAK_URL') return 'http://localhost:8080';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantDomainService,
        {
          provide: KeycloakService,
          useValue: mockKeycloakService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TenantDomainService>(TenantDomainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalizeDomain()', () => {
    it('should normalize domains correctly', () => {
      expect(service.normalizeDomain('ACME.COM')).toBe('acme.com');
      expect(service.normalizeDomain('  acme.com  ')).toBe('acme.com');
      expect(service.normalizeDomain('john.doe@acme.com')).toBe('acme.com');
      expect(service.normalizeDomain('https://portal.acme.com/login')).toBe(
        'portal.acme.com',
      );
      expect(service.normalizeDomain('http://acme.com:3000/app')).toBe('acme.com');
      expect(service.normalizeDomain('')).toBe('');
    });
  });

  describe('registerDomain() and resolveDomain()', () => {
    it('should register a domain and resolve it immediately', async () => {
      const tenantId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
      const tenantName = 'Acme Corp';
      const domain = 'acme.com';

      const record = service.registerDomain(tenantId, tenantName, domain);
      expect(record.domain).toBe('acme.com');
      expect(record.tenantId).toBe(tenantId);
      expect(record.realm).toBe(`tenant-${tenantId}`);

      const resolved = await service.resolveDomain('acme.com');
      expect(resolved).toEqual({
        tenantId,
        tenantName,
        realm: `tenant-${tenantId}`,
        clientId: 'gini-frontend',
        keycloakUrl: `http://localhost:8080/realms/tenant-${tenantId}`,
        loginTheme: 'gini-theme',
      });
    });

    it('should resolve a domain when given a user email', async () => {
      const tenantId = 'tenant-uuid-1';
      service.registerDomain(tenantId, 'Acme Corp', 'acme.com');

      const resolved = await service.resolveDomain('alice.smith@acme.com');
      expect(resolved.tenantId).toBe(tenantId);
      expect(resolved.realm).toBe(`tenant-${tenantId}`);
    });

    it('should fallback to Keycloak realm attributes if domain is not yet in table', async () => {
      const tenantId = 'fallback-tenant-id';
      mockKeycloakService.listAllTenants.mockResolvedValueOnce([
        {
          id: 'realm-id-1',
          realm: `tenant-${tenantId}`,
          displayName: 'Fallback Tenant',
          loginTheme: 'gini-theme',
          attributes: {
            domainName: 'fallback.org',
          },
        },
      ]);

      const resolved = await service.resolveDomain('user@fallback.org');
      expect(mockKeycloakService.listAllTenants).toHaveBeenCalled();
      expect(resolved.tenantId).toBe(tenantId);
      expect(resolved.tenantName).toBe('Fallback Tenant');
      expect(resolved.realm).toBe(`tenant-${tenantId}`);

      // Check that it was auto-cached into the table for the next call
      const cached = await service.resolveDomain('fallback.org');
      expect(cached.tenantId).toBe(tenantId);
      expect(mockKeycloakService.listAllTenants).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException if domain does not exist in table or Keycloak', async () => {
      mockKeycloakService.listAllTenants.mockResolvedValueOnce([]);

      await expect(service.resolveDomain('unknown-company.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if empty domain is provided', async () => {
      await expect(service.resolveDomain('')).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeDomain() and listDomainsForTenant()', () => {
    it('should manage multiple domains for a tenant and remove them', () => {
      const tenantId = 'tenant-multi-id';
      service.registerDomain(tenantId, 'Multi Corp', 'multi.com');
      service.registerDomain(tenantId, 'Multi Corp', 'multicorp.org');

      const domains = service.listDomainsForTenant(tenantId);
      expect(domains.length).toBe(2);
      expect(domains.map((d) => d.domain)).toContain('multi.com');
      expect(domains.map((d) => d.domain)).toContain('multicorp.org');

      const removed = service.removeDomain('multi.com');
      expect(removed).toBe(true);
      expect(service.listDomainsForTenant(tenantId).length).toBe(1);
    });
  });
});
