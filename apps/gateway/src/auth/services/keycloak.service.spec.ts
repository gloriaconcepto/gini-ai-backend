import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { getTenantRealmName } from '../constants/auth.constants';

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
const mockUsersListGroups = jest.fn();
const mockUsersAddToGroup = jest.fn();
const mockUsersDelFromGroup = jest.fn();

const mockGroupsFind = jest.fn();
const mockGroupsFindOne = jest.fn();
const mockGroupsCreate = jest.fn();
const mockGroupsCreateChildGroup = jest.fn();
const mockGroupsUpdate = jest.fn();
const mockGroupsDel = jest.fn();
const mockGroupsListRoleMappings = jest.fn();
const mockGroupsAddRealmRoleMappings = jest.fn();
const mockGroupsDelRealmRoleMappings = jest.fn();
const mockGroupsListMembers = jest.fn();
const mockGroupsListSubGroups = jest.fn();

const mockIdpFindOne = jest.fn();
const mockIdpFindMappers = jest.fn();
const mockIdpCreateMapper = jest.fn();
const mockIdpDelMapper = jest.fn();

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
        listGroups: mockUsersListGroups,
        addToGroup: mockUsersAddToGroup,
        delFromGroup: mockUsersDelFromGroup,
      },
      groups: {
        find: mockGroupsFind,
        findOne: mockGroupsFindOne,
        create: mockGroupsCreate,
        createChildGroup: mockGroupsCreateChildGroup,
        update: mockGroupsUpdate,
        del: mockGroupsDel,
        listRoleMappings: mockGroupsListRoleMappings,
        addRealmRoleMappings: mockGroupsAddRealmRoleMappings,
        delRealmRoleMappings: mockGroupsDelRealmRoleMappings,
        listMembers: mockGroupsListMembers,
        listSubGroups: mockGroupsListSubGroups,
      },
      identityProviders: {
        findOne: mockIdpFindOne,
        findMappers: mockIdpFindMappers,
        createMapper: mockIdpCreateMapper,
        delMapper: mockIdpDelMapper,
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

      // Verify realm creation with persisted clientId attribute
      expect(mockRealmsCreate).toHaveBeenCalledWith({
        realm: `tenant-${tenantId}`,
        displayName: tenantName,
        enabled: true,
        loginTheme: 'gini-theme',
        accountTheme: 'gini-theme',
        adminTheme: 'gini-theme',
        emailTheme: 'gini-theme',
        attributes: {
          ...attributes,
          clientId: 'custom-frontend-client',
        },
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

      // Verify client creation with custom client ID and secure non-wildcard redirect URIs
      expect(mockClientsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realm: `tenant-${tenantId}`,
          clientId: 'custom-frontend-client',
          publicClient: true,
          directAccessGrantsEnabled: true,
          standardFlowEnabled: true,
          redirectUris: expect.arrayContaining(['https://acme.com/*']),
          webOrigins: expect.arrayContaining(['https://acme.com']),
        }),
      );
      const passedClientArgs = mockClientsCreate.mock.calls[0][0];
      expect(passedClientArgs.redirectUris).not.toContain('*');
      expect(passedClientArgs.webOrigins).not.toContain('*');

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
          realm: getTenantRealmName(tenantId),
          username: maker.email,
          email: maker.email,
          firstName: 'Maker',
          lastName: 'User',
        }),
      );
      expect(mockUsersCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          realm: getTenantRealmName(tenantId),
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

      expect(mockRealmsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realm: getTenantRealmName(tenantId),
          attributes: {
            clientId: 'gini-frontend',
          },
        }),
      );
      expect(mockClientsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          realm: getTenantRealmName(tenantId),
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
        realm: getTenantRealmName(tenantId),
        id: userId,
      });
      expect(mockUsersListRealmRoleMappings).toHaveBeenCalledWith({
        realm: getTenantRealmName(tenantId),
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

  describe('Group & Corporate Hierarchy Management', () => {
    const tenantId = 'test-tenant';

    it('should list groups with mapped roles and nested subgroups', async () => {
      mockGroupsFind.mockResolvedValueOnce([
        {
          id: 'grp-1',
          name: 'Engineering',
          path: '/Engineering',
          attributes: { departmentCode: ['ENG-01'] },
          subGroups: [
            {
              id: 'grp-2',
              name: 'DevOps',
              path: '/Engineering/DevOps',
              attributes: {},
              subGroups: [],
            },
          ],
        },
      ]);
      mockGroupsListRoleMappings
        .mockResolvedValueOnce({
          realmMappings: [{ id: 'role-1', name: 'maker' }],
        })
        .mockResolvedValueOnce({
          realmMappings: [{ id: 'role-2', name: 'user' }],
        });

      const result = await service.listGroups(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Engineering');
      expect(result[0].realmRoles).toEqual(['maker']);
      expect(result[0].subGroups).toHaveLength(1);
      expect(result[0].subGroups![0].name).toBe('DevOps');
      expect(result[0].subGroups![0].realmRoles).toEqual(['user']);
    });

    it('should get group by id with roles', async () => {
      mockGroupsFindOne.mockResolvedValueOnce({
        id: 'grp-1',
        name: 'Engineering',
        path: '/Engineering',
        attributes: { departmentCode: ['ENG-01'] },
        subGroups: [],
      });
      mockGroupsListRoleMappings.mockResolvedValueOnce({
        realmMappings: [{ id: 'role-1', name: 'admin' }],
      });

      const result = await service.getGroupById(tenantId, 'grp-1');

      expect(result.id).toBe('grp-1');
      expect(result.name).toBe('Engineering');
      expect(result.realmRoles).toEqual(['admin']);
    });

    it('should throw NotFoundException when group by id is missing', async () => {
      mockGroupsFindOne.mockResolvedValueOnce(null);

      await expect(
        service.getGroupById(tenantId, 'missing-grp'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create top-level group and assign optional roles', async () => {
      mockGroupsCreate.mockResolvedValueOnce({ id: 'new-grp-id' });
      mockRolesFindOneByName.mockResolvedValueOnce({
        id: 'role-id-user',
        name: 'user',
      });
      mockGroupsAddRealmRoleMappings.mockResolvedValueOnce({});

      const result = await service.createGroup(tenantId, {
        name: 'Finance',
        attributes: { costCenter: 'CC-100' },
        roles: ['user'],
      });

      expect(result).toEqual({
        success: true,
        id: 'new-grp-id',
        name: 'Finance',
      });
      expect(mockGroupsCreate).toHaveBeenCalledWith({
        realm: 'tenant-test-tenant',
        name: 'Finance',
        attributes: { costCenter: ['CC-100'] },
      });
      expect(mockGroupsAddRealmRoleMappings).toHaveBeenCalledWith({
        realm: 'tenant-test-tenant',
        id: 'new-grp-id',
        roles: [{ id: 'role-id-user', name: 'user' }],
      });
    });

    it('should create child subgroup under parent group', async () => {
      mockGroupsCreateChildGroup.mockResolvedValueOnce({ id: 'sub-grp-id' });

      const result = await service.createSubGroup(tenantId, 'parent-grp-id', {
        name: 'Auditing',
        attributes: { auditLevel: ['tier-1'] },
      });

      expect(result).toEqual({
        success: true,
        id: 'sub-grp-id',
        parentId: 'parent-grp-id',
        name: 'Auditing',
      });
      expect(mockGroupsCreateChildGroup).toHaveBeenCalledWith(
        { realm: 'tenant-test-tenant', id: 'parent-grp-id' },
        { name: 'Auditing', attributes: { auditLevel: ['tier-1'] } },
      );
    });

    it('should update group name and attributes', async () => {
      mockGroupsUpdate.mockResolvedValueOnce(undefined);

      const result = await service.updateGroup(tenantId, 'grp-id', {
        name: 'Platform Engineering',
        attributes: { teamLead: 'lead@example.com' },
      });

      expect(result).toEqual({ success: true, id: 'grp-id' });
      expect(mockGroupsUpdate).toHaveBeenCalledWith(
        { realm: 'tenant-test-tenant', id: 'grp-id' },
        {
          name: 'Platform Engineering',
          attributes: { teamLead: ['lead@example.com'] },
        },
      );
    });

    it('should delete group by id', async () => {
      mockGroupsDel.mockResolvedValueOnce(undefined);

      const result = await service.deleteGroup(tenantId, 'grp-id');

      expect(result).toEqual({ success: true, id: 'grp-id' });
      expect(mockGroupsDel).toHaveBeenCalledWith({
        realm: 'tenant-test-tenant',
        id: 'grp-id',
      });
    });

    it('should assign role to group', async () => {
      mockRolesFindOneByName.mockResolvedValueOnce({
        id: 'r-1',
        name: 'maker',
      });
      mockGroupsAddRealmRoleMappings.mockResolvedValueOnce({});

      const result = await service.assignRoleToGroup(
        tenantId,
        'grp-id',
        'maker',
      );

      expect(result).toEqual({
        success: true,
        groupId: 'grp-id',
        roleName: 'maker',
      });
    });

    it('should throw NotFoundException when assigning non-existent role to group', async () => {
      mockRolesFindOneByName.mockResolvedValueOnce(null);

      await expect(
        service.assignRoleToGroup(tenantId, 'grp-id', 'ghost-role'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should remove role from group', async () => {
      mockRolesFindOneByName.mockResolvedValueOnce({
        id: 'r-1',
        name: 'maker',
      });
      mockGroupsDelRealmRoleMappings.mockResolvedValueOnce({});

      const result = await service.removeRoleFromGroup(
        tenantId,
        'grp-id',
        'maker',
      );

      expect(result).toEqual({
        success: true,
        groupId: 'grp-id',
        roleName: 'maker',
      });
    });

    it('should list group members', async () => {
      mockGroupsListMembers.mockResolvedValueOnce([
        { id: 'u-1', username: 'alice' },
      ]);

      const result = await service.listGroupMembers(tenantId, 'grp-id');

      expect(result).toEqual([{ id: 'u-1', username: 'alice' }]);
    });
  });

  describe('User Group Memberships', () => {
    const tenantId = 'test-tenant';

    it('should list user groups', async () => {
      mockUsersListGroups.mockResolvedValueOnce([
        { id: 'g-1', name: 'Engineering' },
      ]);

      const result = await service.getUserGroups(tenantId, 'u-1');

      expect(result).toEqual([{ id: 'g-1', name: 'Engineering' }]);
    });

    it('should add user to group', async () => {
      mockUsersAddToGroup.mockResolvedValueOnce(undefined);

      const result = await service.addUserToGroup(tenantId, 'u-1', 'g-1');

      expect(result).toEqual({ success: true, userId: 'u-1', groupId: 'g-1' });
    });

    it('should remove user from group', async () => {
      mockUsersDelFromGroup.mockResolvedValueOnce(undefined);

      const result = await service.removeUserFromGroup(tenantId, 'u-1', 'g-1');

      expect(result).toEqual({ success: true, userId: 'u-1', groupId: 'g-1' });
    });
  });

  describe('Identity Provider Mappers', () => {
    const tenantId = 'test-tenant';

    it('should list IdP mappers', async () => {
      mockIdpFindMappers.mockResolvedValueOnce([
        { id: 'm-1', name: 'Role Mapper' },
      ]);

      const result = await service.listIdpMappers(tenantId, 'azure-ad');

      expect(result).toEqual([{ id: 'm-1', name: 'Role Mapper' }]);
    });

    it('should create IdP mapper', async () => {
      mockIdpCreateMapper.mockResolvedValueOnce({ id: 'new-map-id' });

      const result = await service.createIdpMapper(tenantId, 'azure-ad', {
        name: 'Azure AD Role Mapper',
        identityProviderMapper: 'oidc-role-idp-mapper',
        config: { claim: 'roles', role: 'maker' },
      });

      expect(result).toEqual({
        success: true,
        id: 'new-map-id',
        name: 'Azure AD Role Mapper',
      });
    });

    it('should delete IdP mapper', async () => {
      mockIdpDelMapper.mockResolvedValueOnce(undefined);

      const result = await service.deleteIdpMapper(
        tenantId,
        'azure-ad',
        'map-123',
      );

      expect(result).toEqual({ success: true, id: 'map-123' });
    });
  });

  describe('3rd-Party IdP Directory & Hierarchy Sync Engine', () => {
    const tenantId = 'test-tenant';

    it('should synchronize roles, group tree, subgroups, and group roles', async () => {
      mockIdpFindOne.mockResolvedValueOnce({ alias: 'azure-ad' });
      // Role checking
      mockRolesFindOneByName.mockResolvedValueOnce(null); // role doesn't exist yet
      mockRolesCreate.mockResolvedValueOnce({ id: 'r-lead' });

      // Group checking
      mockGroupsFind.mockResolvedValueOnce([]); // no groups exist initially
      mockGroupsCreate.mockResolvedValueOnce({ id: 'g-root' });
      mockRolesFindOneByName.mockResolvedValueOnce({
        id: 'r-user',
        name: 'user',
      }); // for group role mapping
      mockGroupsAddRealmRoleMappings.mockResolvedValueOnce({});

      // Subgroup checking
      mockGroupsListSubGroups.mockResolvedValueOnce([]); // no subgroups yet
      mockGroupsCreateChildGroup.mockResolvedValueOnce({ id: 'g-sub' });
      mockRolesFindOneByName.mockResolvedValueOnce({
        id: 'r-maker',
        name: 'maker',
      }); // for subgroup role mapping
      mockGroupsAddRealmRoleMappings.mockResolvedValueOnce({});

      const syncDto = {
        roles: [{ name: 'engineering-lead', description: 'Lead engineer' }],
        groups: [
          {
            name: 'Engineering',
            attributes: { departmentCode: ['ENG'] },
            roles: ['user'],
            subGroups: [
              {
                name: 'DevOps',
                attributes: { tier: ['critical'] },
                roles: ['maker'],
              },
            ],
          },
        ],
        providerCredentials: { clientSecret: 'secret-xyz' },
      };

      const result = await service.syncIdpHierarchy(
        tenantId,
        'azure-ad',
        syncDto,
      );

      expect(result.rolesCreated).toBe(1);
      expect(result.groupsCreated).toBe(1);
      expect(result.subgroupsCreated).toBe(1);
      expect(result.roleMappingsCreated).toBe(2);
      expect(result.details).toContain('Created role: engineering-lead');
      expect(result.details).toContain('Created top-level group: Engineering');
      expect(result.details).toContain(
        "Created subgroup 'DevOps' under 'Engineering'",
      );
    });

    it('should throw NotFoundException if Identity Provider does not exist', async () => {
      mockIdpFindOne.mockResolvedValueOnce(null);

      await expect(
        service.syncIdpHierarchy(tenantId, 'non-existent-idp', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
