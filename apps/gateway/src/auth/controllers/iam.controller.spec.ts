import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { IamController } from './iam.controller';
import { KeycloakService } from '../services/keycloak.service';
import { REQUIRE_DUAL_CONTROL_KEY } from '../decorators/require-dual-control.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ChangeRequestStoreService } from '../services/change-request-store.service';
import { MakerCheckerInterceptor } from '../interceptors/maker-checker.interceptor';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());

describe('IamController', () => {
  let controller: IamController;
  let keycloakService: KeycloakService;
  let reflector: Reflector;

  const mockKeycloakService = {
    getUsers: jest.fn(),
    getUserById: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    resetUserPassword: jest.fn(),
    getUserRoles: jest.fn(),
    assignRoleToUser: jest.fn(),
    removeRoleFromUser: jest.fn(),
    listRoles: jest.fn(),
    createRole: jest.fn(),
    deleteRole: jest.fn(),
    listClients: jest.fn(),
    createClient: jest.fn(),
    getClientSecret: jest.fn(),
    deleteClient: jest.fn(),
    listIdentityProviders: jest.fn(),
    createIdentityProvider: jest.fn(),
    updateIdentityProvider: jest.fn(),
    deleteIdentityProvider: jest.fn(),
    listGroups: jest.fn(),
    getGroupById: jest.fn(),
    createGroup: jest.fn(),
    createSubGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    assignRoleToGroup: jest.fn(),
    removeRoleFromGroup: jest.fn(),
    listGroupMembers: jest.fn(),
    getUserGroups: jest.fn(),
    addUserToGroup: jest.fn(),
    removeUserFromGroup: jest.fn(),
    listIdpMappers: jest.fn(),
    createIdpMapper: jest.fn(),
    deleteIdpMapper: jest.fn(),
    syncIdpHierarchy: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IamController],
      providers: [
        {
          provide: KeycloakService,
          useValue: mockKeycloakService,
        },
        Reflector,
        ChangeRequestStoreService,
        MakerCheckerInterceptor,
      ],
    }).compile();

    controller = module.get<IamController>(IamController);
    keycloakService = module.get<KeycloakService>(KeycloakService);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Metadata and Dual-Control Enforcement', () => {
    it('should have roles ["maker", "checker", "admin"] on class level', () => {
      const classRoles = reflector.get(ROLES_KEY, IamController);
      expect(classRoles).toEqual(['maker', 'checker', 'admin']);
    });

    it('should require dual-control and maker role on createUser', () => {
      const dualControl = reflector.get(
        REQUIRE_DUAL_CONTROL_KEY,
        controller.createUser,
      );
      const roles = reflector.get(ROLES_KEY, controller.createUser);
      expect(dualControl).toBe('CREATE_USER');
      expect(roles).toEqual(['maker']);
    });

    it('should require dual-control and maker role on deleteUser', () => {
      const dualControl = reflector.get(
        REQUIRE_DUAL_CONTROL_KEY,
        controller.deleteUser,
      );
      const roles = reflector.get(ROLES_KEY, controller.deleteUser);
      expect(dualControl).toBe('DELETE_USER');
      expect(roles).toEqual(['maker']);
    });

    it('should require dual-control and maker role on createRole', () => {
      const dualControl = reflector.get(
        REQUIRE_DUAL_CONTROL_KEY,
        controller.createRole,
      );
      const roles = reflector.get(ROLES_KEY, controller.createRole);
      expect(dualControl).toBe('CREATE_ROLE');
      expect(roles).toEqual(['maker']);
    });

    it('should require dual-control and maker role on createClient', () => {
      const dualControl = reflector.get(
        REQUIRE_DUAL_CONTROL_KEY,
        controller.createClient,
      );
      const roles = reflector.get(ROLES_KEY, controller.createClient);
      expect(dualControl).toBe('CREATE_CLIENT');
      expect(roles).toEqual(['maker']);
    });

    it('should require dual-control and maker role on createIdp', () => {
      const dualControl = reflector.get(
        REQUIRE_DUAL_CONTROL_KEY,
        controller.createIdp,
      );
      const roles = reflector.get(ROLES_KEY, controller.createIdp);
      expect(dualControl).toBe('CREATE_IDP');
      expect(roles).toEqual(['maker']);
    });

    it('should require dual-control and maker role on group operations', () => {
      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.createGroup),
      ).toBe('CREATE_GROUP');
      expect(reflector.get(ROLES_KEY, controller.createGroup)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.createSubGroup),
      ).toBe('CREATE_SUBGROUP');
      expect(reflector.get(ROLES_KEY, controller.createSubGroup)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.updateGroup),
      ).toBe('UPDATE_GROUP');
      expect(reflector.get(ROLES_KEY, controller.updateGroup)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.deleteGroup),
      ).toBe('DELETE_GROUP');
      expect(reflector.get(ROLES_KEY, controller.deleteGroup)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.assignRoleToGroup),
      ).toBe('ASSIGN_GROUP_ROLE');
      expect(reflector.get(ROLES_KEY, controller.assignRoleToGroup)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.removeRoleFromGroup),
      ).toBe('REMOVE_GROUP_ROLE');
      expect(reflector.get(ROLES_KEY, controller.removeRoleFromGroup)).toEqual([
        'maker',
      ]);
    });

    it('should require dual-control and maker role on user group operations', () => {
      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.addUserToGroup),
      ).toBe('ADD_USER_TO_GROUP');
      expect(reflector.get(ROLES_KEY, controller.addUserToGroup)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.removeUserFromGroup),
      ).toBe('REMOVE_USER_FROM_GROUP');
      expect(reflector.get(ROLES_KEY, controller.removeUserFromGroup)).toEqual([
        'maker',
      ]);
    });

    it('should require dual-control and maker role on IdP mapper and sync operations', () => {
      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.createIdpMapper),
      ).toBe('CREATE_IDP_MAPPER');
      expect(reflector.get(ROLES_KEY, controller.createIdpMapper)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.deleteIdpMapper),
      ).toBe('DELETE_IDP_MAPPER');
      expect(reflector.get(ROLES_KEY, controller.deleteIdpMapper)).toEqual([
        'maker',
      ]);

      expect(
        reflector.get(REQUIRE_DUAL_CONTROL_KEY, controller.syncIdpHierarchy),
      ).toBe('SYNC_IDP_HIERARCHY');
      expect(reflector.get(ROLES_KEY, controller.syncIdpHierarchy)).toEqual([
        'maker',
      ]);
    });
  });

  describe('getUser()', () => {
    it('should delegate to keycloakService.getUserById and return user with assigned roles', async () => {
      const mockUserResponse = {
        id: 'user-123',
        username: 'johndoe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        enabled: true,
        emailVerified: true,
        roles: ['admin', 'maker'],
        createdTimestamp: 1693750000000,
      };

      mockKeycloakService.getUserById.mockResolvedValueOnce(mockUserResponse);

      const mockReq = {
        user: {
          tenantId: 'tenant-999',
          userId: 'admin-1',
          username: 'admin@acme.com',
          roles: ['admin'],
          issuer: 'http://localhost:8080/realms/tenant-999',
        },
      } as any;

      const result = await controller.getUser(mockReq, 'user-123');

      expect(mockKeycloakService.getUserById).toHaveBeenCalledWith(
        'tenant-999',
        'user-123',
      );
      expect(result).toEqual(mockUserResponse);
      expect(result.roles).toEqual(['admin', 'maker']);
    });
  });

  describe('getUsers()', () => {
    it('should delegate to keycloakService.getUsers', async () => {
      const mockUsers = [{ id: 'u1' }, { id: 'u2' }];
      mockKeycloakService.getUsers.mockResolvedValueOnce(mockUsers);

      const mockReq = {
        user: {
          tenantId: 'tenant-999',
        },
      } as any;

      const result = await controller.getUsers(mockReq);

      expect(mockKeycloakService.getUsers).toHaveBeenCalledWith('tenant-999');
      expect(result).toEqual(mockUsers);
    });
  });

  describe('Handler execution direct delegation', () => {
    const mockReq = {
      user: {
        tenantId: 'tenant-999',
        userId: 'maker-1',
        username: 'maker@acme.com',
        roles: ['maker'],
      },
    } as any;

    it('should delegate createUser to keycloakService', async () => {
      mockKeycloakService.createUser.mockResolvedValueOnce({ id: 'u-new' });
      const result = await controller.createUser(mockReq, {
        username: 'newuser',
        email: 'new@acme.com',
        password: 'Password123!',
      });
      expect(mockKeycloakService.createUser).toHaveBeenCalledWith(
        'tenant-999',
        {
          username: 'newuser',
          email: 'new@acme.com',
          password: 'Password123!',
        },
      );
      expect(result).toEqual({ id: 'u-new' });
    });

    it('should delegate deleteUser to keycloakService', async () => {
      mockKeycloakService.deleteUser.mockResolvedValueOnce(undefined);
      await controller.deleteUser(mockReq, 'u-123');
      expect(mockKeycloakService.deleteUser).toHaveBeenCalledWith(
        'tenant-999',
        'u-123',
      );
    });

    it('should delegate createRole to keycloakService', async () => {
      mockKeycloakService.createRole.mockResolvedValueOnce({ name: 'editor' });
      const result = await controller.createRole(mockReq, { name: 'editor' });
      expect(mockKeycloakService.createRole).toHaveBeenCalledWith(
        'tenant-999',
        {
          name: 'editor',
        },
      );
      expect(result).toEqual({ name: 'editor' });
    });

    it('should delegate getGroups and getGroup to keycloakService', async () => {
      mockKeycloakService.listGroups.mockResolvedValueOnce([{ id: 'g1' }]);
      mockKeycloakService.getGroupById.mockResolvedValueOnce({ id: 'g1' });

      const groups = await controller.getGroups(mockReq);
      expect(mockKeycloakService.listGroups).toHaveBeenCalledWith('tenant-999');
      expect(groups).toEqual([{ id: 'g1' }]);

      const group = await controller.getGroup(mockReq, 'g1');
      expect(mockKeycloakService.getGroupById).toHaveBeenCalledWith(
        'tenant-999',
        'g1',
      );
      expect(group).toEqual({ id: 'g1' });
    });

    it('should delegate createGroup and createSubGroup to keycloakService', async () => {
      mockKeycloakService.createGroup.mockResolvedValueOnce({ id: 'g1' });
      mockKeycloakService.createSubGroup.mockResolvedValueOnce({ id: 'g2' });

      const g1 = await controller.createGroup(mockReq, { name: 'Eng' });
      expect(mockKeycloakService.createGroup).toHaveBeenCalledWith(
        'tenant-999',
        { name: 'Eng' },
      );
      expect(g1).toEqual({ id: 'g1' });

      const g2 = await controller.createSubGroup(mockReq, 'g1', {
        name: 'DevOps',
      });
      expect(mockKeycloakService.createSubGroup).toHaveBeenCalledWith(
        'tenant-999',
        'g1',
        { name: 'DevOps' },
      );
      expect(g2).toEqual({ id: 'g2' });
    });

    it('should delegate updateGroup and deleteGroup to keycloakService', async () => {
      mockKeycloakService.updateGroup.mockResolvedValueOnce({ success: true });
      mockKeycloakService.deleteGroup.mockResolvedValueOnce({ success: true });

      await controller.updateGroup(mockReq, 'g1', { name: 'Engineering' });
      expect(mockKeycloakService.updateGroup).toHaveBeenCalledWith(
        'tenant-999',
        'g1',
        { name: 'Engineering' },
      );

      await controller.deleteGroup(mockReq, 'g1');
      expect(mockKeycloakService.deleteGroup).toHaveBeenCalledWith(
        'tenant-999',
        'g1',
      );
    });

    it('should delegate assignRoleToGroup, removeRoleFromGroup, and listGroupMembers to keycloakService', async () => {
      mockKeycloakService.assignRoleToGroup.mockResolvedValueOnce({
        success: true,
      });
      mockKeycloakService.removeRoleFromGroup.mockResolvedValueOnce({
        success: true,
      });
      mockKeycloakService.listGroupMembers.mockResolvedValueOnce([
        { id: 'u1' },
      ]);

      await controller.assignRoleToGroup(mockReq, 'g1', { roleName: 'maker' });
      expect(mockKeycloakService.assignRoleToGroup).toHaveBeenCalledWith(
        'tenant-999',
        'g1',
        'maker',
      );

      await controller.removeRoleFromGroup(mockReq, 'g1', 'maker');
      expect(mockKeycloakService.removeRoleFromGroup).toHaveBeenCalledWith(
        'tenant-999',
        'g1',
        'maker',
      );

      const members = await controller.listGroupMembers(mockReq, 'g1');
      expect(mockKeycloakService.listGroupMembers).toHaveBeenCalledWith(
        'tenant-999',
        'g1',
      );
      expect(members).toEqual([{ id: 'u1' }]);
    });

    it('should delegate user group membership actions to keycloakService', async () => {
      mockKeycloakService.getUserGroups.mockResolvedValueOnce([{ id: 'g1' }]);
      mockKeycloakService.addUserToGroup.mockResolvedValueOnce({
        success: true,
      });
      mockKeycloakService.removeUserFromGroup.mockResolvedValueOnce({
        success: true,
      });

      const userGroups = await controller.getUserGroups(mockReq, 'u1');
      expect(mockKeycloakService.getUserGroups).toHaveBeenCalledWith(
        'tenant-999',
        'u1',
      );
      expect(userGroups).toEqual([{ id: 'g1' }]);

      await controller.addUserToGroup(mockReq, 'u1', 'g1');
      expect(mockKeycloakService.addUserToGroup).toHaveBeenCalledWith(
        'tenant-999',
        'u1',
        'g1',
      );

      await controller.removeUserFromGroup(mockReq, 'u1', 'g1');
      expect(mockKeycloakService.removeUserFromGroup).toHaveBeenCalledWith(
        'tenant-999',
        'u1',
        'g1',
      );
    });

    it('should delegate IdP mapper and sync actions to keycloakService', async () => {
      mockKeycloakService.listIdpMappers.mockResolvedValueOnce([
        { id: 'map1' },
      ]);
      mockKeycloakService.createIdpMapper.mockResolvedValueOnce({
        id: 'map1',
      });
      mockKeycloakService.deleteIdpMapper.mockResolvedValueOnce({
        success: true,
      });
      mockKeycloakService.syncIdpHierarchy.mockResolvedValueOnce({
        rolesCreated: 1,
      });

      const mappers = await controller.listIdpMappers(mockReq, 'azure-ad');
      expect(mockKeycloakService.listIdpMappers).toHaveBeenCalledWith(
        'tenant-999',
        'azure-ad',
      );
      expect(mappers).toEqual([{ id: 'map1' }]);

      const mapper = await controller.createIdpMapper(mockReq, 'azure-ad', {
        name: 'Roles',
        identityProviderMapper: 'oidc-role-idp-mapper',
        config: {},
      });
      expect(mockKeycloakService.createIdpMapper).toHaveBeenCalledWith(
        'tenant-999',
        'azure-ad',
        {
          name: 'Roles',
          identityProviderMapper: 'oidc-role-idp-mapper',
          config: {},
        },
      );
      expect(mapper).toEqual({ id: 'map1' });

      await controller.deleteIdpMapper(mockReq, 'azure-ad', 'map1');
      expect(mockKeycloakService.deleteIdpMapper).toHaveBeenCalledWith(
        'tenant-999',
        'azure-ad',
        'map1',
      );

      const syncRes = await controller.syncIdpHierarchy(mockReq, 'azure-ad', {
        roles: [{ name: 'lead' }],
      });
      expect(mockKeycloakService.syncIdpHierarchy).toHaveBeenCalledWith(
        'tenant-999',
        'azure-ad',
        { roles: [{ name: 'lead' }] },
      );
      expect(syncRes).toEqual({ rolesCreated: 1 });
    });
  });
});
