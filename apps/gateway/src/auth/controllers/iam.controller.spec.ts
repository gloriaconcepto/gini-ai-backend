import { Test, TestingModule } from '@nestjs/testing';
import { IamController } from './iam.controller';
import { KeycloakService } from '../services/keycloak.service';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());

describe('IamController', () => {
  let controller: IamController;
  let keycloakService: KeycloakService;

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
      ],
    }).compile();

    controller = module.get<IamController>(IamController);
    keycloakService = module.get<KeycloakService>(KeycloakService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
});
