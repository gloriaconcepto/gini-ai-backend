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
});
