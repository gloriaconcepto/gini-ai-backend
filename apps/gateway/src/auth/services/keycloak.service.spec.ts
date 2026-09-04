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
const mockUsersFindOne = jest.fn();
const mockUsersListRealmRoleMappings = jest.fn();
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
        findOne: mockUsersFindOne,
        listRealmRoleMappings: mockUsersListRealmRoleMappings,
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
              if (key === 'KEYCLOAK_URL') return 'http://localhost:8080';
              if (key === 'KEYCLOAK_ADMIN_CLIENT_ID')
                return 'gini-gateway-service';
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
      jest
        .spyOn(configService, 'getOrThrow')
        .mockImplementation((key: string) => {
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
      mockUsersCreate
        .mockResolvedValueOnce({ id: 'maker-123' })
        .mockResolvedValueOnce({ id: 'checker-456' });
      mockRolesFindOneByName.mockImplementation(({ name }: { name: string }) =>
        Promise.resolve({ id: `role-${name}-id`, name }),
      );
      mockUsersAddRealmRoleMappings.mockResolvedValue(undefined);
    });

    it('should provision realm, governance roles including admin, frontend client, and dual maker/checker users with admin roles', async () => {
      const tenantId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
      const tenantName = 'Acme Corp';
      const maker = {
        email: 'maker@acme.com',
        password: 'securePassword123',
        firstName: 'Alice',
        lastName: 'Smith',
      };
      const checker = {
        email: 'checker@acme.com',
        password: 'securePassword456',
        firstName: 'Bob',
        lastName: 'Jones',
      };
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
        maker,
        checker,
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

      // Verify roles creation includes maker, checker, auditor, user, admin
      const createdRoleNames = mockRolesCreate.mock.calls.map(
        (call: any[]) => call[0].name,
      );
      expect(createdRoleNames).toEqual([
        'maker',
        'checker',
        'auditor',
        'user',
        'admin',
      ]);
      expect(createdRoleNames).toContain('admin');

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

      // Verify default Maker user creation & role mapping (maker + admin)
      expect(mockUsersCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          username: maker.email,
          email: maker.email,
          firstName: 'Alice',
          lastName: 'Smith',
        }),
      );
      expect(mockUsersAddRealmRoleMappings).toHaveBeenCalledWith({
        realm: `tenant-${tenantId}`,
        id: 'maker-123',
        roles: expect.arrayContaining([
          expect.objectContaining({ name: 'maker' }),
          expect.objectContaining({ name: 'admin' }),
        ]),
      });

      // Verify default Checker user creation & role mapping (checker + admin)
      expect(mockUsersCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          username: checker.email,
          email: checker.email,
          firstName: 'Bob',
          lastName: 'Jones',
        }),
      );
      expect(mockUsersAddRealmRoleMappings).toHaveBeenCalledWith({
        realm: `tenant-${tenantId}`,
        id: 'checker-456',
        roles: expect.arrayContaining([
          expect.objectContaining({ name: 'checker' }),
          expect.objectContaining({ name: 'admin' }),
        ]),
      });

      // Verify clean response payload with dual users
      expect(result).toMatchObject({
        tenantId,
        tenantName,
        realm: `tenant-${tenantId}`,
        clientId: 'custom-frontend-client',
        maker: {
          id: 'maker-123',
          email: maker.email,
          username: maker.email,
          firstName: 'Alice',
          lastName: 'Smith',
          roles: ['maker', 'admin'],
        },
        checker: {
          id: 'checker-456',
          email: checker.email,
          username: checker.email,
          firstName: 'Bob',
          lastName: 'Jones',
          roles: ['checker', 'admin'],
        },
        enabled: true,
        roles: ['maker', 'checker', 'auditor', 'user', 'admin'],
        industry: 'Finance',
        domainName: 'acme.com',
        subscriptionTier: 'Enterprise',
        taxId: '12-3456789',
        billingAddress: '123 Main St, USA',
        contactPhone: '+1-555-0198',
      });
      expect(result.createdAt).toBeDefined();
    });

    it('should fallback to default Maker/Checker and User when first and last names are omitted', async () => {
      const tenantId = 'tenant-id-defaults';
      const tenantName = 'Default User Corp';
      const maker = {
        email: 'maker@defaults.com',
        password: 'securePassword123',
      };
      const checker = {
        email: 'checker@defaults.com',
        password: 'securePassword456',
      };

      const result = await service.provisionTenantRealm(
        tenantId,
        tenantName,
        maker,
        checker,
      );

      expect(mockUsersCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          username: maker.email,
          email: maker.email,
          firstName: 'Maker',
          lastName: 'User',
        }),
      );
      expect(mockUsersCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          username: checker.email,
          email: checker.email,
          firstName: 'Checker',
          lastName: 'User',
        }),
      );
      expect(result.maker.firstName).toBeUndefined();
      expect(result.checker.firstName).toBeUndefined();
    });

    it('should default client ID to gini-frontend when not provided', async () => {
      const tenantId = 'tenant-id-456';
      const tenantName = 'Default Corp';
      const maker = {
        email: 'maker@defaults.com',
        password: 'securePassword123',
      };
      const checker = {
        email: 'checker@defaults.com',
        password: 'securePassword456',
      };

      const result = await service.provisionTenantRealm(
        tenantId,
        tenantName,
        maker,
        checker,
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

  describe('getUserById()', () => {
    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'mock-token' }),
      } as any);
    });

    it('should return user details along with assigned role names', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-abc';
      mockUsersFindOne.mockResolvedValueOnce({
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        enabled: true,
      });
      mockUsersListRealmRoleMappings.mockResolvedValueOnce([
        { id: 'role-1', name: 'admin' },
        { id: 'role-2', name: 'maker' },
      ]);

      const result = await service.getUserById(tenantId, userId);

      expect(mockUsersFindOne).toHaveBeenCalledWith({
        realm: `tenant-${tenantId}`,
        id: userId,
      });
      expect(mockUsersListRealmRoleMappings).toHaveBeenCalledWith({
        realm: `tenant-${tenantId}`,
        id: userId,
      });
      expect(result).toEqual({
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        enabled: true,
        roles: ['admin', 'maker'],
      });
    });

    it('should return empty roles array when user has no assigned roles', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-abc';
      mockUsersFindOne.mockResolvedValueOnce({
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        enabled: true,
      });
      mockUsersListRealmRoleMappings.mockResolvedValueOnce([]);

      const result = await service.getUserById(tenantId, userId);

      expect(result).toEqual({
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        enabled: true,
        roles: [],
      });
    });

    it('should handle role mapping error gracefully by returning empty roles array', async () => {
      const tenantId = 'tenant-123';
      const userId = 'user-abc';
      mockUsersFindOne.mockResolvedValueOnce({
        id: userId,
        username: 'johndoe',
        email: 'john@example.com',
        enabled: true,
      });
      mockUsersListRealmRoleMappings.mockRejectedValueOnce(
        new Error('Keycloak network failure'),
      );

      const result = await service.getUserById(tenantId, userId);

      expect(result.roles).toEqual([]);
    });

    it('should throw NotFoundException when user is not found', async () => {
      const tenantId = 'tenant-123';
      const userId = 'non-existent-user';
      mockUsersFindOne.mockResolvedValueOnce(null);
      mockUsersListRealmRoleMappings.mockResolvedValueOnce([]);

      await expect(service.getUserById(tenantId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
