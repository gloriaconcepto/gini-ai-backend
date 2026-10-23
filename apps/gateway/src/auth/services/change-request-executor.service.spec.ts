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
    createGroup: jest.fn(),
    createSubGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
    assignRoleToGroup: jest.fn(),
    removeRoleFromGroup: jest.fn(),
    addUserToGroup: jest.fn(),
    removeUserFromGroup: jest.fn(),
    createIdpMapper: jest.fn(),
    deleteIdpMapper: jest.fn(),
    syncIdpHierarchy: jest.fn(),
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

  it('should execute CREATE_GROUP', async () => {
    mockKeycloakService.createGroup.mockResolvedValueOnce({ id: 'grp-1' });
    const req = baseRequest('CREATE_GROUP', {
      body: { name: 'Engineering', attributes: { dept: ['ENG'] } },
    });

    const res = await service.execute(req);
    expect(mockKeycloakService.createGroup).toHaveBeenCalledWith('tenant-1', {
      name: 'Engineering',
      attributes: { dept: ['ENG'] },
    });
    expect(res).toEqual({ id: 'grp-1' });
  });

  it('should execute CREATE_SUBGROUP', async () => {
    mockKeycloakService.createSubGroup.mockResolvedValueOnce({ id: 'sub-1' });
    const req = baseRequest(
      'CREATE_SUBGROUP',
      { body: { name: 'DevOps' }, params: { groupId: 'grp-1' } },
      'grp-1',
    );

    const res = await service.execute(req);
    expect(mockKeycloakService.createSubGroup).toHaveBeenCalledWith(
      'tenant-1',
      'grp-1',
      { name: 'DevOps' },
    );
    expect(res).toEqual({ id: 'sub-1' });
  });

  it('should throw BadRequestException on CREATE_SUBGROUP if groupId is missing', async () => {
    const req = baseRequest('CREATE_SUBGROUP', { body: { name: 'DevOps' } });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute UPDATE_GROUP', async () => {
    mockKeycloakService.updateGroup.mockResolvedValueOnce({ success: true });
    const req = baseRequest(
      'UPDATE_GROUP',
      { body: { name: 'New Name' }, params: { groupId: 'grp-1' } },
      'grp-1',
    );

    await service.execute(req);
    expect(mockKeycloakService.updateGroup).toHaveBeenCalledWith(
      'tenant-1',
      'grp-1',
      { name: 'New Name' },
    );
  });

  it('should throw BadRequestException on UPDATE_GROUP if groupId is missing', async () => {
    const req = baseRequest('UPDATE_GROUP', { body: { name: 'New Name' } });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute DELETE_GROUP', async () => {
    mockKeycloakService.deleteGroup.mockResolvedValueOnce({ success: true });
    const req = baseRequest(
      'DELETE_GROUP',
      { params: { groupId: 'grp-1' } },
      'grp-1',
    );

    await service.execute(req);
    expect(mockKeycloakService.deleteGroup).toHaveBeenCalledWith(
      'tenant-1',
      'grp-1',
    );
  });

  it('should throw BadRequestException on DELETE_GROUP if groupId is missing', async () => {
    const req = baseRequest('DELETE_GROUP', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute ASSIGN_GROUP_ROLE', async () => {
    mockKeycloakService.assignRoleToGroup.mockResolvedValueOnce({
      success: true,
    });
    const req = baseRequest(
      'ASSIGN_GROUP_ROLE',
      { body: { roleName: 'maker' }, params: { groupId: 'grp-1' } },
      'grp-1',
    );

    await service.execute(req);
    expect(mockKeycloakService.assignRoleToGroup).toHaveBeenCalledWith(
      'tenant-1',
      'grp-1',
      'maker',
    );
  });

  it('should throw BadRequestException on ASSIGN_GROUP_ROLE if groupId or roleName is missing', async () => {
    const req = baseRequest('ASSIGN_GROUP_ROLE', { body: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute REMOVE_GROUP_ROLE', async () => {
    mockKeycloakService.removeRoleFromGroup.mockResolvedValueOnce({
      success: true,
    });
    const req = baseRequest(
      'REMOVE_GROUP_ROLE',
      { params: { groupId: 'grp-1', roleName: 'maker' } },
      'grp-1',
    );

    await service.execute(req);
    expect(mockKeycloakService.removeRoleFromGroup).toHaveBeenCalledWith(
      'tenant-1',
      'grp-1',
      'maker',
    );
  });

  it('should throw BadRequestException on REMOVE_GROUP_ROLE if params are missing', async () => {
    const req = baseRequest('REMOVE_GROUP_ROLE', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute ADD_USER_TO_GROUP', async () => {
    mockKeycloakService.addUserToGroup.mockResolvedValueOnce({ success: true });
    const req = baseRequest(
      'ADD_USER_TO_GROUP',
      { params: { userId: 'u-1', groupId: 'g-1' } },
      'u-1',
    );

    await service.execute(req);
    expect(mockKeycloakService.addUserToGroup).toHaveBeenCalledWith(
      'tenant-1',
      'u-1',
      'g-1',
    );
  });

  it('should throw BadRequestException on ADD_USER_TO_GROUP if userId or groupId is missing', async () => {
    const req = baseRequest('ADD_USER_TO_GROUP', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute REMOVE_USER_FROM_GROUP', async () => {
    mockKeycloakService.removeUserFromGroup.mockResolvedValueOnce({
      success: true,
    });
    const req = baseRequest(
      'REMOVE_USER_FROM_GROUP',
      { params: { userId: 'u-1', groupId: 'g-1' } },
      'u-1',
    );

    await service.execute(req);
    expect(mockKeycloakService.removeUserFromGroup).toHaveBeenCalledWith(
      'tenant-1',
      'u-1',
      'g-1',
    );
  });

  it('should throw BadRequestException on REMOVE_USER_FROM_GROUP if userId or groupId is missing', async () => {
    const req = baseRequest('REMOVE_USER_FROM_GROUP', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute CREATE_IDP_MAPPER', async () => {
    mockKeycloakService.createIdpMapper.mockResolvedValueOnce({ id: 'map-1' });
    const req = baseRequest('CREATE_IDP_MAPPER', {
      params: { alias: 'azure-ad' },
      body: {
        name: 'Mapper',
        identityProviderMapper: 'oidc-role-idp-mapper',
        config: {},
      },
    });

    const res = await service.execute(req);
    expect(mockKeycloakService.createIdpMapper).toHaveBeenCalledWith(
      'tenant-1',
      'azure-ad',
      {
        name: 'Mapper',
        identityProviderMapper: 'oidc-role-idp-mapper',
        config: {},
      },
    );
    expect(res).toEqual({ id: 'map-1' });
  });

  it('should throw BadRequestException on CREATE_IDP_MAPPER if alias is missing', async () => {
    const req = baseRequest('CREATE_IDP_MAPPER', { body: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute DELETE_IDP_MAPPER', async () => {
    mockKeycloakService.deleteIdpMapper.mockResolvedValueOnce({ id: 'map-1' });
    const req = baseRequest(
      'DELETE_IDP_MAPPER',
      { params: { alias: 'azure-ad', mapperId: 'map-1' } },
      'map-1',
    );

    const res = await service.execute(req);
    expect(mockKeycloakService.deleteIdpMapper).toHaveBeenCalledWith(
      'tenant-1',
      'azure-ad',
      'map-1',
    );
    expect(res).toEqual({ id: 'map-1' });
  });

  it('should throw BadRequestException on DELETE_IDP_MAPPER if params are missing', async () => {
    const req = baseRequest('DELETE_IDP_MAPPER', { params: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should execute SYNC_IDP_HIERARCHY', async () => {
    mockKeycloakService.syncIdpHierarchy.mockResolvedValueOnce({
      rolesCreated: 1,
      groupsCreated: 1,
      subgroupsCreated: 0,
      roleMappingsCreated: 0,
      details: ['Created role: lead'],
    });
    const req = baseRequest(
      'SYNC_IDP_HIERARCHY',
      {
        params: { alias: 'azure-ad' },
        body: { roles: [{ name: 'lead' }] },
      },
      'azure-ad',
    );

    const res = await service.execute(req);
    expect(mockKeycloakService.syncIdpHierarchy).toHaveBeenCalledWith(
      'tenant-1',
      'azure-ad',
      { roles: [{ name: 'lead' }] },
    );
    expect(res).toEqual({
      rolesCreated: 1,
      groupsCreated: 1,
      subgroupsCreated: 0,
      roleMappingsCreated: 0,
      details: ['Created role: lead'],
    });
  });

  it('should throw BadRequestException on SYNC_IDP_HIERARCHY if alias is missing', async () => {
    const req = baseRequest('SYNC_IDP_HIERARCHY', { body: {} });
    await expect(service.execute(req)).rejects.toThrow(BadRequestException);
  });

  it('should throw InternalServerErrorException for unknown action type', async () => {
    const req = baseRequest('UNKNOWN_ACTION' as any, {});
    await expect(service.execute(req)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
