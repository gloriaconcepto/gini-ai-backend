import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';

const mockSetAccessToken = jest.fn();
const mockIsTokenExpired = jest.fn().mockReturnValue(true);
const mockRealmsFind = jest.fn();
const mockRealmsFindOne = jest.fn();
const mockRealmsCreate = jest.fn();
const mockRealmsDel = jest.fn();
const mockRolesCreate = jest.fn();
const mockRolesFindOneByName = jest.fn();
const mockClientsCreate = jest.fn();
const mockUsersCreate = jest.fn();
const mockUsersAddRealmRoleMappings = jest.fn();

jest.mock('@keycloak/keycloak-admin-client', () => {
  return jest.fn().mockImplementation(() => {
    return {
      setAccessToken: mockSetAccessToken,
      isTokenExpired: mockIsTokenExpired,
      accessToken: null,
      realms: {
        find: mockRealmsFind,
        findOne: mockRealmsFindOne,
        create: mockRealmsCreate,
        del: mockRealmsDel,
      },
      roles: {
        create: mockRolesCreate,
        findOneByName: mockRolesFindOneByName,
      },
      clients: {
        create: mockClientsCreate,
      },
      users: {
        create: mockUsersCreate,
        addRealmRoleMappings: mockUsersAddRealmRoleMappings,
      },
    };
  });
});

describe('KeycloakService', () => {
  let service: KeycloakService;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'KEYCLOAK_URL') return 'http://localhost:8080';
              return defaultValue;
            }),
            getOrThrow: jest.fn((key: string) => {
              if (key === 'KEYCLOAK_ADMIN_CLIENT_ID') return 'gini-gateway-service';
              if (key === 'KEYCLOAK_ADMIN_CLIENT_SECRET') return 'test-secret';
              throw new Error(`Configuration key "${key}" does not exist`);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<KeycloakService>(KeycloakService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('authenticate()', () => {
    it('should authenticate using client_credentials and set access token', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'mock-access-token' }),
      } as any);
      mockRealmsFind.mockResolvedValueOnce([
        { realm: 'master' },
        { realm: 'tenant-123' },
      ]);

      const tenants = await service.listAllTenants();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockSetAccessToken).toHaveBeenCalledWith('mock-access-token');
      expect(tenants).toEqual([{ realm: 'tenant-123' }]);
    });

    it('should throw an error when token endpoint returns non-200', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized client',
      } as any);

      await expect(service.listAllTenants()).rejects.toThrow(
        'Keycloak token endpoint responded with status 401: Unauthorized client',
      );
      expect(mockSetAccessToken).not.toHaveBeenCalled();
    });

    it('should throw if KEYCLOAK_ADMIN_CLIENT_ID or SECRET is missing', async () => {
      jest.spyOn(configService, 'getOrThrow').mockImplementation((key: string) => {
        throw new Error(`Configuration key "${key}" does not exist`);
      });

      await expect(service.listAllTenants()).rejects.toThrow(
        'Configuration key "KEYCLOAK_ADMIN_CLIENT_ID" does not exist',
      );
    });
  });

  describe('Tenant Realm Resolution and Deletion', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'mock-token' }),
      } as any);
    });

    it('should delete tenant when provided with full realm name tenant-uuid', async () => {
      mockRealmsFindOne.mockResolvedValueOnce({ realm: 'tenant-abc-123' });
      mockRealmsDel.mockResolvedValueOnce(undefined);

      const res = await service.deleteTenant('tenant-abc-123');

      expect(mockRealmsDel).toHaveBeenCalledWith({ realm: 'tenant-abc-123' });
      expect(res).toEqual({ success: true });
    });

    it('should delete tenant when provided with tenant ID uuid without prefix', async () => {
      mockRealmsFindOne.mockResolvedValueOnce({ realm: 'tenant-abc-123' });
      mockRealmsDel.mockResolvedValueOnce(undefined);

      const res = await service.deleteTenant('abc-123');

      expect(mockRealmsDel).toHaveBeenCalledWith({ realm: 'tenant-abc-123' });
      expect(res).toEqual({ success: true });
    });

    it('should delete tenant when provided with Keycloak internal database ID', async () => {
      mockRealmsFindOne.mockResolvedValueOnce(null);
      mockRealmsFind.mockResolvedValueOnce([
        { id: 'kc-internal-id-888', realm: 'tenant-xyz-999' },
      ]);
      mockRealmsDel.mockResolvedValueOnce(undefined);

      const res = await service.deleteTenant('kc-internal-id-888');

      expect(mockRealmsDel).toHaveBeenCalledWith({ realm: 'tenant-xyz-999' });
      expect(res).toEqual({ success: true });
    });

    it('should throw NotFoundException when tenant identifier cannot be resolved', async () => {
      mockRealmsFindOne.mockResolvedValueOnce(null);
      mockRealmsFind.mockResolvedValueOnce([]);

      await expect(service.deleteTenant('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('provisionTenantRealm()', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'mock-token' }),
      } as any);
      mockRealmsCreate.mockResolvedValue(undefined);
      mockRolesCreate.mockResolvedValue(undefined);
      mockClientsCreate.mockResolvedValue(undefined);
      mockUsersCreate.mockResolvedValue({ id: 'user-123' });
      mockRolesFindOneByName.mockImplementation(({ name }: { name: string }) =>
        Promise.resolve({ id: `role-${name}-id`, name }),
      );
      mockUsersAddRealmRoleMappings.mockResolvedValue(undefined);
    });

    it('should provision realm, default governance roles, frontend client, and return clean response payload', async () => {
      const tenantId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
      const tenantName = 'Acme Corp';
      const adminEmail = 'admin@acme.com';
      const adminPassword = 'securePassword123';
      const attributes = {
        industry: 'Finance',
        domainName: 'acme.com',
        subscriptionTier: 'Enterprise',
        taxId: '12-3456789',
        billingAddress: '123 Main St, USA',
        contactPhone: '+1-555-0198',
      };

      const result = await service.provisionTenantRealm(
        tenantId,
        tenantName,
        adminEmail,
        adminPassword,
        attributes,
        'custom-frontend-client',
      );

      // Verify realm creation
      expect(mockRealmsCreate).toHaveBeenCalledWith({
        realm: `tenant-${tenantId}`,
        displayName: tenantName,
        enabled: true,
        loginTheme: 'gini-theme',
        accountTheme: 'gini-theme',
        adminTheme: 'gini-theme',
        emailTheme: 'gini-theme',
        attributes,
      });

      // Verify roles creation includes Maker, Checker, Auditor, User, Admin
      const createdRoleNames = mockRolesCreate.mock.calls.map(
        (call: any[]) => call[0].name,
      );
      expect(createdRoleNames).toContain('Maker');
      expect(createdRoleNames).toContain('Checker');
      expect(createdRoleNames).toContain('Auditor');
      expect(createdRoleNames).toContain('User');
      expect(createdRoleNames).toContain('Admin');

      // Verify client creation with custom client ID
      expect(mockClientsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          clientId: 'custom-frontend-client',
          publicClient: true,
          directAccessGrantsEnabled: true,
          standardFlowEnabled: true,
        }),
      );

      // Verify default admin user creation & role mapping
      expect(mockUsersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          username: adminEmail,
          email: adminEmail,
        }),
      );
      expect(mockUsersAddRealmRoleMappings).toHaveBeenCalledWith({
        realm: `tenant-${tenantId}`,
        id: 'user-123',
        roles: expect.arrayContaining([
          expect.objectContaining({ name: 'Admin' }),
        ]),
      });

      // Verify clean response payload
      expect(result).toMatchObject({
        tenantId,
        tenantName,
        realm: `tenant-${tenantId}`,
        clientId: 'custom-frontend-client',
        adminEmail,
        enabled: true,
        roles: ['Maker', 'Checker', 'Auditor', 'User', 'Admin'],
        industry: 'Finance',
        domainName: 'acme.com',
        subscriptionTier: 'Enterprise',
        taxId: '12-3456789',
        billingAddress: '123 Main St, USA',
        contactPhone: '+1-555-0198',
      });
      expect(result.createdAt).toBeDefined();
      expect((result as any).adminPassword).toBeUndefined();
    });

    it('should default client ID to gini-frontend when not provided', async () => {
      const tenantId = 'tenant-id-456';
      const tenantName = 'Default Corp';

      const result = await service.provisionTenantRealm(
        tenantId,
        tenantName,
      );

      expect(mockClientsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          clientId: 'gini-frontend',
        }),
      );
      expect(result.clientId).toEqual('gini-frontend');
    });
  });
});

