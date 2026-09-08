import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

jest.mock('@keycloak/keycloak-admin-client', () => jest.fn());
import { ChangeRequestExecutorService } from './change-request-executor.service';
import { KeycloakService } from './keycloak.service';
import { ChangeRequest } from '../entities/change-request.entity';

describe('ChangeRequestExecutorService', () => {
  let service: ChangeRequestExecutorService;
  let keycloakService: KeycloakService;

  const mockKeycloakService = {
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    resetUserPassword: jest.fn(),
    assignRoleToUser: jest.fn(),
    removeRoleFromUser: jest.fn(),
    createRole: jest.fn(),
    deleteRole: jest.fn(),
    createClient: jest.fn(),
    deleteClient: jest.fn(),
    createIdentityProvider: jest.fn(),
    updateIdentityProvider: jest.fn(),
    deleteIdentityProvider: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    keycloakService = mockKeycloakService as unknown as KeycloakService;
    service = new ChangeRequestExecutorService(keycloakService);
  });

  const baseRequest = (
    actionType: any,
    payload: any,
    targetResourceId?: string,
  ): ChangeRequest => ({
    id: 'req-1',
    tenantId: 'tenant-1',
    actionType,
    targetResource: 'test',
    targetResourceId,
    payload,
    makerId: 'maker-1',
    makerUsername: 'maker@tenant.com',
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('should execute CREATE_USER', async () => {
    mockKeycloakService.createUser.mockResolvedValueOnce({ id: 'user-1' });
    const req = baseRequest('CREATE_USER', {
      body: { username: 'test', email: 'test@t.com', password: '123' },
    });

    const res = await service.execute(req);
    expect(mockKeycloakService.createUser).toHaveBeenCalledWith('tenant-1', {
      username: 'test',
      email: 'test@t.com',
      password: '123',
    });
    expect(res).toEqual({ id: 'user-1' });
  });

  it('should execute UPDATE_USER', async () => {
    mockKeycloakService.updateUser.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'UPDATE_USER',
      { body: { firstName: 'Updated' }, params: { userId: 'u-123' } },
      'u-123',
    );

    await service.execute(req);
    expect(mockKeycloakService.updateUser).toHaveBeenCalledWith(
      'tenant-1',
      'u-123',
      { firstName: 'Updated' },
    );
  });

  it('should throw BadRequestException on UPDATE_USER if userId is missing', async () => {
    const req = baseRequest('UPDATE_USER', { body: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute DELETE_USER', async () => {
    mockKeycloakService.deleteUser.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'DELETE_USER',
      { params: { userId: 'u-123' } },
      'u-123',
    );

    await service.execute(req);
    expect(mockKeycloakService.deleteUser).toHaveBeenCalledWith(
      'tenant-1',
      'u-123',
    );
  });

  it('should throw BadRequestException on DELETE_USER if userId is missing', async () => {
    const req = baseRequest('DELETE_USER', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute RESET_PASSWORD', async () => {
    mockKeycloakService.resetUserPassword.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'RESET_PASSWORD',
      { body: { newPassword: 'new' }, params: { userId: 'u-123' } },
      'u-123',
    );

    await service.execute(req);
    expect(mockKeycloakService.resetUserPassword).toHaveBeenCalledWith(
      'tenant-1',
      'u-123',
      { newPassword: 'new' },
    );
  });

  it('should execute ASSIGN_ROLE', async () => {
    mockKeycloakService.assignRoleToUser.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'ASSIGN_ROLE',
      { body: { roleName: 'auditor' }, params: { userId: 'u-123' } },
      'u-123',
    );

    await service.execute(req);
    expect(mockKeycloakService.assignRoleToUser).toHaveBeenCalledWith(
      'tenant-1',
      'u-123',
      'auditor',
    );
  });

  it('should execute REMOVE_ROLE', async () => {
    mockKeycloakService.removeRoleFromUser.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'REMOVE_ROLE',
      { params: { userId: 'u-123', roleName: 'auditor' } },
      'u-123',
    );

    await service.execute(req);
    expect(mockKeycloakService.removeRoleFromUser).toHaveBeenCalledWith(
      'tenant-1',
      'u-123',
      'auditor',
    );
  });

  it('should execute CREATE_ROLE', async () => {
    mockKeycloakService.createRole.mockResolvedValueOnce({ name: 'custom' });
    const req = baseRequest('CREATE_ROLE', {
      body: { name: 'custom', description: 'desc' },
    });

    await service.execute(req);
    expect(mockKeycloakService.createRole).toHaveBeenCalledWith('tenant-1', {
      name: 'custom',
      description: 'desc',
    });
  });

  it('should execute DELETE_ROLE', async () => {
    mockKeycloakService.deleteRole.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'DELETE_ROLE',
      { params: { roleName: 'custom' } },
      'custom',
    );

    await service.execute(req);
    expect(mockKeycloakService.deleteRole).toHaveBeenCalledWith(
      'tenant-1',
      'custom',
    );
  });

  it('should execute CREATE_CLIENT', async () => {
    mockKeycloakService.createClient.mockResolvedValueOnce({ id: 'c-1' });
    const req = baseRequest('CREATE_CLIENT', {
      body: { clientId: 'client-app', name: 'app' },
    });

    await service.execute(req);
    expect(mockKeycloakService.createClient).toHaveBeenCalledWith('tenant-1', {
      clientId: 'client-app',
      name: 'app',
    });
  });

  it('should execute DELETE_CLIENT', async () => {
    mockKeycloakService.deleteClient.mockResolvedValueOnce(undefined);
    const req = baseRequest('DELETE_CLIENT', { params: { id: 'c-1' } }, 'c-1');

    await service.execute(req);
    expect(mockKeycloakService.deleteClient).toHaveBeenCalledWith(
      'tenant-1',
      'c-1',
    );
  });

  it('should execute CREATE_IDP', async () => {
    mockKeycloakService.createIdentityProvider.mockResolvedValueOnce({
      alias: 'google',
    });
    const req = baseRequest('CREATE_IDP', {
      body: { alias: 'google', providerId: 'google' },
    });

    await service.execute(req);
    expect(mockKeycloakService.createIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      { alias: 'google', providerId: 'google' },
    );
  });

  it('should execute UPDATE_IDP', async () => {
    mockKeycloakService.updateIdentityProvider.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'UPDATE_IDP',
      { body: { displayName: 'Google' }, params: { alias: 'google' } },
      'google',
    );

    await service.execute(req);
    expect(mockKeycloakService.updateIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      'google',
      { displayName: 'Google' },
    );
  });

  it('should execute DELETE_IDP', async () => {
    mockKeycloakService.deleteIdentityProvider.mockResolvedValueOnce(undefined);
    const req = baseRequest(
      'DELETE_IDP',
      { params: { alias: 'google' } },
      'google',
    );

    await service.execute(req);
    expect(mockKeycloakService.deleteIdentityProvider).toHaveBeenCalledWith(
      'tenant-1',
      'google',
    );
  });

  it('should throw BadRequestException on RESET_PASSWORD if userId is missing', async () => {
    const req = baseRequest('RESET_PASSWORD', { body: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException on ASSIGN_ROLE if userId or roleName is missing', async () => {
    const reqNoRole = baseRequest(
      'ASSIGN_ROLE',
      { params: { userId: 'u1' } },
      'u1',
    );
    await expect(service.execute(reqNoRole)).rejects.toThrow(
      BadRequestException,
    );

    const reqNoUser = baseRequest('ASSIGN_ROLE', { body: { roleName: 'r1' } });
    await expect(service.execute(reqNoUser)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on REMOVE_ROLE if userId or roleName is missing', async () => {
    const reqNoRole = baseRequest(
      'REMOVE_ROLE',
      { params: { userId: 'u1' } },
      'u1',
    );
    await expect(service.execute(reqNoRole)).rejects.toThrow(
      BadRequestException,
    );

    const reqNoUser = baseRequest('REMOVE_ROLE', {
      params: { roleName: 'r1' },
    });
    await expect(service.execute(reqNoUser)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on DELETE_ROLE if roleName is missing', async () => {
    const req = baseRequest('DELETE_ROLE', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException on DELETE_CLIENT if clientId is missing', async () => {
    const req = baseRequest('DELETE_CLIENT', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException on UPDATE_IDP if alias is missing', async () => {
    const req = baseRequest('UPDATE_IDP', { body: { displayName: 'test' } });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException on DELETE_IDP if alias is missing', async () => {
    const req = baseRequest('DELETE_IDP', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should throw InternalServerErrorException for unknown action type', async () => {
    const req = baseRequest('UNKNOWN_ACTION' as any, {});
    await expect(service.execute(req)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
