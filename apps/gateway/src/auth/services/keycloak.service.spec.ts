import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeycloakService } from './keycloak.service';

const mockAuth = jest.fn();
const mockRealmsFind = jest.fn();
const mockRealmsCreate = jest.fn();

jest.mock('@keycloak/keycloak-admin-client', () => {
  return jest.fn().mockImplementation(() => {
    return {
      auth: mockAuth,
      realms: {
        find: mockRealmsFind,
        create: mockRealmsCreate,
      },
      roles: {
        create: jest.fn(),
        findOneByName: jest.fn(),
      },
      clients: {
        create: jest.fn(),
      },
      users: {
        create: jest.fn(),
        addRealmRoleMappings: jest.fn(),
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
    it('should strictly authenticate using client_credentials', async () => {
      mockAuth.mockResolvedValueOnce(undefined);
      mockRealmsFind.mockResolvedValueOnce([
        { realm: 'master' },
        { realm: 'tenant-123' },
      ]);

      const tenants = await service.listAllTenants();

      expect(mockAuth).toHaveBeenCalledTimes(1);
      expect(mockAuth).toHaveBeenCalledWith({
        grantType: 'client_credentials',
        clientId: 'gini-gateway-service',
        clientSecret: 'test-secret',
      });
      expect(tenants).toEqual([{ realm: 'tenant-123' }]);
    });

    it('should throw an error and not fallback to password grant when client_credentials fails', async () => {
      mockAuth.mockRejectedValueOnce(new Error('Invalid client credentials'));

      await expect(service.listAllTenants()).rejects.toThrow('Invalid client credentials');
      expect(mockAuth).toHaveBeenCalledTimes(1);
      expect(mockAuth).toHaveBeenCalledWith({
        grantType: 'client_credentials',
        clientId: 'gini-gateway-service',
        clientSecret: 'test-secret',
      });
    });

    it('should throw if KEYCLOAK_ADMIN_CLIENT_ID or SECRET is missing', async () => {
      jest.spyOn(configService, 'getOrThrow').mockImplementation((key: string) => {
        throw new Error(`Configuration key "${key}" does not exist`);
      });

      await expect(service.listAllTenants()).rejects.toThrow(
        'Configuration key "KEYCLOAK_ADMIN_CLIENT_ID" does not exist',
      );
      expect(mockAuth).not.toHaveBeenCalled();
    });
  });
});
