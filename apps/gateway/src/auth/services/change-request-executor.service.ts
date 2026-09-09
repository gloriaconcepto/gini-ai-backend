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

      default:
        throw new InternalServerErrorException(
          `Unhandled action type: ${(actionType as string) || 'UNKNOWN'}`,
        );
    }
  }
}
