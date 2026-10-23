import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { ChangeRequest } from '../entities/change-request.entity';
import {
  CreateIamUserDto,
  ResetPasswordDto,
  CreateIamRoleDto,
  CreateIamClientDto,
  CreateIdpDto,
} from '../dto/iam.dtos';
import type {
  CreateIamGroupDto,
  CreateIamSubgroupDto,
} from '../dto/iam-group.dtos';
import type { CreateIdpMapperDto } from '../dto/iam-idp-mapper.dtos';

interface RequestPayload {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class ChangeRequestExecutorService {
  constructor(private readonly keycloakService: KeycloakService) {}

  async execute(request: ChangeRequest): Promise<unknown> {
    const { tenantId, actionType, targetResourceId } = request;
    const payload = request.payload as RequestPayload;
    const body = payload?.body ?? payload ?? {};
    const params = payload?.params ?? {};

    switch (actionType) {
      case 'CREATE_USER':
        return this.keycloakService.createUser(
          tenantId,
          body as unknown as CreateIamUserDto,
        );

      case 'UPDATE_USER': {
        const userId = targetResourceId || params.userId;
        if (!userId) {
          throw new BadRequestException(
            'Missing userId for UPDATE_USER action',
          );
        }
        return this.keycloakService.updateUser(tenantId, userId, body);
      }

      case 'DELETE_USER': {
        const userId = targetResourceId || params.userId;
        if (!userId) {
          throw new BadRequestException(
            'Missing userId for DELETE_USER action',
          );
        }
        return this.keycloakService.deleteUser(tenantId, userId);
      }

      case 'RESET_PASSWORD': {
        const userId = targetResourceId || params.userId;
        if (!userId) {
          throw new BadRequestException(
            'Missing userId for RESET_PASSWORD action',
          );
        }
        return this.keycloakService.resetUserPassword(
          tenantId,
          userId,
          body as unknown as ResetPasswordDto,
        );
      }

      case 'ASSIGN_ROLE': {
        const userId = targetResourceId || params.userId;
        const roleName = (body.roleName as string) || params.roleName;
        if (!userId || !roleName) {
          throw new BadRequestException(
            'Missing userId or roleName for ASSIGN_ROLE action',
          );
        }
        return this.keycloakService.assignRoleToUser(
          tenantId,
          userId,
          roleName,
        );
      }

      case 'REMOVE_ROLE': {
        const userId = targetResourceId || params.userId;
        const roleName = params.roleName || (body.roleName as string);
        if (!userId || !roleName) {
          throw new BadRequestException(
            'Missing userId or roleName for REMOVE_ROLE action',
          );
        }
        return this.keycloakService.removeRoleFromUser(
          tenantId,
          userId,
          roleName,
        );
      }

      case 'CREATE_ROLE':
        return this.keycloakService.createRole(
          tenantId,
          body as unknown as CreateIamRoleDto,
        );

      case 'DELETE_ROLE': {
        const roleName =
          targetResourceId || params.roleName || (body.roleName as string);
        if (!roleName) {
          throw new BadRequestException(
            'Missing roleName for DELETE_ROLE action',
          );
        }
        return this.keycloakService.deleteRole(tenantId, roleName);
      }

      case 'CREATE_CLIENT':
        return this.keycloakService.createClient(
          tenantId,
          body as unknown as CreateIamClientDto,
        );

      case 'DELETE_CLIENT': {
        const clientId = targetResourceId || params.id || (body.id as string);
        if (!clientId) {
          throw new BadRequestException(
            'Missing client id for DELETE_CLIENT action',
          );
        }
        return this.keycloakService.deleteClient(tenantId, clientId);
      }

      case 'CREATE_IDP':
        return this.keycloakService.createIdentityProvider(
          tenantId,
          body as unknown as CreateIdpDto,
        );

      case 'UPDATE_IDP': {
        const alias =
          targetResourceId || params.alias || (body.alias as string);
        if (!alias) {
          throw new BadRequestException('Missing alias for UPDATE_IDP action');
        }
        return this.keycloakService.updateIdentityProvider(
          tenantId,
          alias,
          body,
        );
      }

      case 'DELETE_IDP': {
        const alias =
          targetResourceId || params.alias || (body.alias as string);
        if (!alias) {
          throw new BadRequestException('Missing alias for DELETE_IDP action');
        }
        return this.keycloakService.deleteIdentityProvider(tenantId, alias);
      }

      case 'CREATE_GROUP':
        return this.keycloakService.createGroup(
          tenantId,
          body as unknown as CreateIamGroupDto,
        );

      case 'CREATE_SUBGROUP': {
        const groupId =
          targetResourceId || params.groupId || (body.groupId as string);
        if (!groupId) {
          throw new BadRequestException(
            'Missing groupId for CREATE_SUBGROUP action',
          );
        }
        return this.keycloakService.createSubGroup(
          tenantId,
          groupId,
          body as unknown as CreateIamSubgroupDto,
        );
      }

      case 'UPDATE_GROUP': {
        const groupId =
          targetResourceId || params.groupId || (body.groupId as string);
        if (!groupId) {
          throw new BadRequestException(
            'Missing groupId for UPDATE_GROUP action',
          );
        }
        return this.keycloakService.updateGroup(tenantId, groupId, body);
      }

      case 'DELETE_GROUP': {
        const groupId =
          targetResourceId || params.groupId || (body.groupId as string);
        if (!groupId) {
          throw new BadRequestException(
            'Missing groupId for DELETE_GROUP action',
          );
        }
        return this.keycloakService.deleteGroup(tenantId, groupId);
      }

      case 'ASSIGN_GROUP_ROLE': {
        const groupId =
          targetResourceId || params.groupId || (body.groupId as string);
        const roleName = (body.roleName as string) || params.roleName;
        if (!groupId || !roleName) {
          throw new BadRequestException(
            'Missing groupId or roleName for ASSIGN_GROUP_ROLE action',
          );
        }
        return this.keycloakService.assignRoleToGroup(
          tenantId,
          groupId,
          roleName,
        );
      }

      case 'REMOVE_GROUP_ROLE': {
        const groupId =
          targetResourceId || params.groupId || (body.groupId as string);
        const roleName = params.roleName || (body.roleName as string);
        if (!groupId || !roleName) {
          throw new BadRequestException(
            'Missing groupId or roleName for REMOVE_GROUP_ROLE action',
          );
        }
        return this.keycloakService.removeRoleFromGroup(
          tenantId,
          groupId,
          roleName,
        );
      }

      case 'ADD_USER_TO_GROUP': {
        const userId =
          targetResourceId || params.userId || (body.userId as string);
        const groupId = params.groupId || (body.groupId as string);
        if (!userId || !groupId) {
          throw new BadRequestException(
            'Missing userId or groupId for ADD_USER_TO_GROUP action',
          );
        }
        return this.keycloakService.addUserToGroup(tenantId, userId, groupId);
      }

      case 'REMOVE_USER_FROM_GROUP': {
        const userId =
          targetResourceId || params.userId || (body.userId as string);
        const groupId = params.groupId || (body.groupId as string);
        if (!userId || !groupId) {
          throw new BadRequestException(
            'Missing userId or groupId for REMOVE_USER_FROM_GROUP action',
          );
        }
        return this.keycloakService.removeUserFromGroup(
          tenantId,
          userId,
          groupId,
        );
      }

      case 'CREATE_IDP_MAPPER': {
        const alias = params.alias || (body.alias as string);
        if (!alias) {
          throw new BadRequestException(
            'Missing alias for CREATE_IDP_MAPPER action',
          );
        }
        return this.keycloakService.createIdpMapper(
          tenantId,
          alias,
          body as unknown as CreateIdpMapperDto,
        );
      }

      case 'DELETE_IDP_MAPPER': {
        const alias = params.alias || (body.alias as string);
        const mapperId =
          targetResourceId || params.mapperId || (body.mapperId as string);
        if (!alias || !mapperId) {
          throw new BadRequestException(
            'Missing alias or mapperId for DELETE_IDP_MAPPER action',
          );
        }
        return this.keycloakService.deleteIdpMapper(tenantId, alias, mapperId);
      }

      case 'SYNC_IDP_HIERARCHY': {
        const alias =
          targetResourceId || params.alias || (body.alias as string);
        if (!alias) {
          throw new BadRequestException(
            'Missing alias for SYNC_IDP_HIERARCHY action',
          );
        }
        return this.keycloakService.syncIdpHierarchy(tenantId, alias, body);
      }

      default:
        throw new InternalServerErrorException(
          `Unhandled action type: ${(actionType as string) || 'UNKNOWN'}`,
        );
    }
  }
}
