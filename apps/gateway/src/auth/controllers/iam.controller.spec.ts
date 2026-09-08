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
  });
});
