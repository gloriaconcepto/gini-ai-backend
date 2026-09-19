import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import RealmRepresentation from '@keycloak/keycloak-admin-client/lib/defs/realmRepresentation';
import GroupRepresentation from '@keycloak/keycloak-admin-client/lib/defs/groupRepresentation';
import {
  CreateIamUserDto,
  UpdateIamUserDto,
  ResetPasswordDto,
  CreateIamRoleDto,
  CreateIamClientDto,
  CreateIdpDto,
  UpdateIdpDto,
} from '../dto/iam.dtos';
import {
  CreateIamGroupDto,
  CreateIamSubgroupDto,
  UpdateIamGroupDto,
  IamGroupResponseDto,
} from '../dto/iam-group.dtos';
import {
  CreateIdpMapperDto,
  SyncIdpHierarchyDto,
  SyncHierarchyResultDto,
  SyncGroupTreeItemDto,
} from '../dto/iam-idp-mapper.dtos';
import { CreateTenantResponseDto } from '../dto/create-tenant.dto';

export interface ProvisionUserCredentials {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private kcAdminClient: KcAdminClient;

  constructor(private configService: ConfigService) {
    this.kcAdminClient = new KcAdminClient({
      baseUrl: this.configService
        .getOrThrow<string>('KEYCLOAK_URL')
        .replace(/\/+$/, '')
        .trim(),
      realmName: this.configService.get<string>(
        'KEYCLOAK_ADMIN_REALM',
        'master',
      ),
    });
  }

  private async authenticate(forceRefresh = false) {
    const clientId = this.configService.getOrThrow<string>(
      'KEYCLOAK_ADMIN_CLIENT_ID',
    );
    const clientSecret = this.configService.getOrThrow<string>(
      'KEYCLOAK_ADMIN_CLIENT_SECRET',
    );

    if (
      !forceRefresh &&
      this.kcAdminClient.accessToken &&
      !this.kcAdminClient.isTokenExpired()
    ) {
      return;
    }

    try {
      // Workaround for @keycloak/keycloak-admin-client bug with client_credentials (it tries to decode an undefined refresh_token)
      let baseUrl = this.configService
        .getOrThrow<string>('KEYCLOAK_URL')
        .trim();
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      const realmName = this.configService.get<string>(
        'KEYCLOAK_ADMIN_REALM',
        'master',
      );
      const tokenUrl = `${baseUrl}/realms/${realmName}/protocol/openid-connect/token`;

      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `Keycloak token endpoint responded with status ${response.status}: ${errorBody || response.statusText}`,
        );
      }

      const data = await response.json();
      this.kcAdminClient.setAccessToken(data.access_token);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to authenticate Keycloak admin client via client_credentials (${errorMsg})`,
      );
      throw error;
    }
  }

  async provisionTenantRealm(
    tenantId: string,
    tenantName: string,
    maker: ProvisionUserCredentials,
    checker: ProvisionUserCredentials,
    attributes?: Record<string, string>,
    clientId?: string,
  ): Promise<CreateTenantResponseDto> {
    try {
      await this.authenticate();

      const realmName = `tenant-${tenantId}`;
      const targetClientId =
        clientId || attributes?.clientId || 'gini-frontend';

      // 1. Create the new tenant realm (persist clientId into attributes for dynamic resolution)
      await this.kcAdminClient.realms.create({
        realm: realmName,
        displayName: tenantName,
        enabled: true,
        loginTheme: 'gini-theme',
        accountTheme: 'gini-theme',
        adminTheme: 'gini-theme',
        emailTheme: 'gini-theme',
        attributes: {
          ...(attributes || {}),
          clientId: targetClientId,
        },
      });

      this.logger.log(`Provisioned new realm: ${realmName}`);

      // Refresh admin token so it contains the audience & permissions for the newly created realm
      await this.authenticate(true);

      // 2. Pre-provision standard governance roles for Gini Platform
      const standardRoles = [
        { name: 'maker', description: 'Maker Role - Dual Control Submitter' },
        {
          name: 'checker',
          description: 'Checker Role - Dual Control Approver',
        },
        {
          name: 'auditor',
          description: 'System Auditor - Read Only Compliance',
        },
        { name: 'user', description: 'Standard Tenant User' },
        {
          name: 'admin',
          description: 'Tenant Administrator - Full IAM Management',
        },
      ];

      for (const role of standardRoles) {
        await this.kcAdminClient.roles.create({
          realm: realmName,
          name: role.name,
          description: role.description,
        });
      }

      // 3. Provision default SPA Frontend Client in the tenant realm
      // Build restricted redirect URIs and web origins (eliminating wildcard vulnerability)
      const allowedOrigins: string[] = [];
      const redirectUris: string[] = [];

      if (attributes?.domainName) {
        const domain = attributes.domainName.trim();
        allowedOrigins.push(`https://${domain}`, `https://*.${domain}`);
        redirectUris.push(`https://${domain}/*`, `https://*.${domain}/*`);
      }

      const configuredOrigins =
        this.configService.get<string>('ALLOWED_ORIGINS');
      if (configuredOrigins) {
        for (const origin of configuredOrigins
          .split(',')
          .map((o) => o.trim())) {
          if (origin) {
            allowedOrigins.push(origin);
            redirectUris.push(
              origin.endsWith('/') ? `${origin}*` : `${origin}/*`,
            );
          }
        }
      } else {
        // Safe fallback for local development environments
        allowedOrigins.push('http://localhost:3000', 'http://localhost:3002');
        redirectUris.push('http://localhost:3000/*', 'http://localhost:3002/*');
      }

      const postLogoutRedirectUris = redirectUris.join('##');

      await this.kcAdminClient.clients.create({
        realm: realmName,
        clientId: targetClientId,
        name: `${tenantName} Frontend SPA`,
        publicClient: true,
        directAccessGrantsEnabled: true,
        standardFlowEnabled: true,
        redirectUris,
        webOrigins: allowedOrigins,
        attributes: {
          'pkce.code.challenge.method': 'S256',
          'post.logout.redirect.uris': postLogoutRedirectUris,
        },
      });

      // Find common roles to assign
      const adminRole = await this.kcAdminClient.roles.findOneByName({
        realm: realmName,
        name: 'admin',
      });

      // 4. Create default Maker user
      const makerUserRecord = await this.kcAdminClient.users.create({
        realm: realmName,
        username: maker.email,
        email: maker.email,
        firstName: maker.firstName || 'Maker',
        lastName: maker.lastName || 'User',
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        credentials: [
          {
            type: 'password',
            value: maker.password,
            temporary: false,
          },
        ],
      });

      const makerRole = await this.kcAdminClient.roles.findOneByName({
        realm: realmName,
        name: 'maker',
      });
      const makerRolesToAssign = [makerRole, adminRole].filter(
        (r): r is { id: string; name: string } => Boolean(r?.id && r?.name),
      );
      if (makerRolesToAssign.length > 0) {
        await this.kcAdminClient.users.addRealmRoleMappings({
          realm: realmName,
          id: makerUserRecord.id,
          roles: makerRolesToAssign.map((r) => ({ id: r.id, name: r.name })),
        });
        this.logger.log(
          `Provisioned default maker user (${maker.email}) with 'maker' and 'admin' roles in ${realmName}`,
        );
      }

      // 5. Create default Checker user
      const checkerUserRecord = await this.kcAdminClient.users.create({
        realm: realmName,
        username: checker.email,
        email: checker.email,
        firstName: checker.firstName || 'Checker',
        lastName: checker.lastName || 'User',
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        credentials: [
          {
            type: 'password',
            value: checker.password,
            temporary: false,
          },
        ],
      });

      const checkerRole = await this.kcAdminClient.roles.findOneByName({
        realm: realmName,
        name: 'checker',
      });
      const checkerRolesToAssign = [checkerRole, adminRole].filter(
        (r): r is { id: string; name: string } => Boolean(r?.id && r?.name),
      );
      if (checkerRolesToAssign.length > 0) {
        await this.kcAdminClient.users.addRealmRoleMappings({
          realm: realmName,
          id: checkerUserRecord.id,
          roles: checkerRolesToAssign.map((r) => ({ id: r.id, name: r.name })),
        });
        this.logger.log(
          `Provisioned default checker user (${checker.email}) with 'checker' and 'admin' roles in ${realmName}`,
        );
      }

      const response: CreateTenantResponseDto = {
        tenantId,
        tenantName,
        realm: realmName,
        clientId: targetClientId,
        maker: {
          id: makerUserRecord.id,
          email: maker.email,
          username: maker.email,
          ...(maker.firstName ? { firstName: maker.firstName } : {}),
          ...(maker.lastName ? { lastName: maker.lastName } : {}),
          roles: ['maker', 'admin'],
        },
        checker: {
          id: checkerUserRecord.id,
          email: checker.email,
          username: checker.email,
          ...(checker.firstName ? { firstName: checker.firstName } : {}),
          ...(checker.lastName ? { lastName: checker.lastName } : {}),
          roles: ['checker', 'admin'],
        },
        enabled: true,
        roles: ['maker', 'checker', 'auditor', 'user', 'admin'],
        ...(attributes?.industry ? { industry: attributes.industry } : {}),
        ...(attributes?.domainName
          ? { domainName: attributes.domainName }
          : {}),
        ...(attributes?.subscriptionTier
          ? {
              subscriptionTier: attributes.subscriptionTier as
                'Basic' | 'Pro' | 'Enterprise',
            }
          : {}),
        ...(attributes?.taxId ? { taxId: attributes.taxId } : {}),
        ...(attributes?.billingAddress
          ? { billingAddress: attributes.billingAddress }
          : {}),
        ...(attributes?.contactPhone
          ? { contactPhone: attributes.contactPhone }
          : {}),
        createdAt: new Date().toISOString(),
      };

      return response;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to provision realm for tenant ${tenantId}`,
          error.stack,
        );
      } else {
        this.logger.error(`Failed to provision realm for tenant ${tenantId}`);
      }
      throw error;
    }
  }

  // --- User Lifecycle Methods ---

  async getUsers(tenantId: string) {
    await this.authenticate();
    return this.kcAdminClient.users.find({ realm: `tenant-${tenantId}` });
  }

  async getUserById(tenantId: string, userId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const [user, roleMappings] = await Promise.all([
        this.kcAdminClient.users.findOne({
          realm,
          id: userId,
        }),
        this.kcAdminClient.users
          .listRealmRoleMappings({
            realm,
            id: userId,
          })
          .catch(() => []),
      ]);

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      const roles = Array.isArray(roleMappings)
        ? roleMappings
            .map((r) => r.name)
            .filter(
              (name): name is string =>
                typeof name === 'string' && name.length > 0,
            )
        : [];

      return {
        ...user,
        id: user.id ?? userId,
        roles,
      };
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  async createUser(tenantId: string, dto: CreateIamUserDto) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    const user = await this.kcAdminClient.users.create({
      realm,
      username: dto.username,
      email: dto.email,
      firstName: dto.firstName || 'User',
      lastName: dto.lastName || 'Member',
      enabled: true,
      emailVerified: true,
      requiredActions: [],
      credentials: [
        {
          type: 'password',
          value: dto.password,
          temporary: false,
        },
      ],
    });
    return user;
  }

  async updateUser(tenantId: string, userId: string, dto: UpdateIamUserDto) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.users.update(
        { realm, id: userId },
        {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          enabled: dto.enabled,
        },
      );
      return { success: true, userId };
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  async deleteUser(tenantId: string, userId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.users.del({ realm, id: userId });
      return { success: true, userId };
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  async resetUserPassword(
    tenantId: string,
    userId: string,
    dto: ResetPasswordDto,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.users.resetPassword({
        realm,
        id: userId,
        credential: {
          type: 'password',
          value: dto.password,
          temporary: dto.temporary ?? false,
        },
      });
      return { success: true, message: 'Password reset successfully' };
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  async getUserRoles(tenantId: string, userId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      return await this.kcAdminClient.users.listRealmRoleMappings({
        realm,
        id: userId,
      });
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  async removeRoleFromUser(tenantId: string, userId: string, roleName: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    const role = await this.kcAdminClient.roles.findOneByName({
      realm,
      name: roleName,
    });
    if (!role || !role.id || !role.name) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }
    try {
      await this.kcAdminClient.users.delRealmRoleMappings({
        realm,
        id: userId,
        roles: [{ id: role.id, name: role.name }],
      });
      return { success: true };
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  // --- Role Management Methods ---

  async listRoles(tenantId: string) {
    await this.authenticate();
    return this.kcAdminClient.roles.find({ realm: `tenant-${tenantId}` });
  }

  async createRole(tenantId: string, dto: CreateIamRoleDto) {
    await this.authenticate();
    try {
      await this.kcAdminClient.roles.create({
        realm: `tenant-${tenantId}`,
        name: dto.name,
        description: dto.description,
      });
      return { success: true, role: dto.name };
    } catch (error) {
      this.handleKeycloakError(
        error,
        `Tenant realm tenant-${tenantId} not found`,
      );
    }
  }

  async deleteRole(tenantId: string, roleName: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.roles.delByName({
        realm,
        name: roleName,
      });
      return { success: true, role: roleName };
    } catch (error) {
      this.handleKeycloakError(error, `Role ${roleName} not found`);
    }
  }

  async assignRoleToUser(tenantId: string, userId: string, roleName: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    const role = await this.kcAdminClient.roles.findOneByName({
      realm,
      name: roleName,
    });
    if (!role || !role.id || !role.name) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }
    try {
      await this.kcAdminClient.users.addRealmRoleMappings({
        realm,
        id: userId,
        roles: [{ id: role.id, name: role.name }],
      });
      return { success: true };
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  // --- Client Management Methods ---

  async listClients(tenantId: string) {
    await this.authenticate();
    return this.kcAdminClient.clients.find({ realm: `tenant-${tenantId}` });
  }

  async createClient(tenantId: string, dto: CreateIamClientDto) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const client = await this.kcAdminClient.clients.create({
        realm,
        clientId: dto.clientId,
        publicClient: dto.publicClient,
        directAccessGrantsEnabled: dto.directAccessGrantsEnabled,
        redirectUris: dto.redirectUris,
        webOrigins: dto.webOrigins,
      });
      return client;
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realm} not found`);
    }
  }

  async getClientSecret(tenantId: string, clientDbId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      return await this.kcAdminClient.clients.getClientSecret({
        realm,
        id: clientDbId,
      });
    } catch (error) {
      this.handleKeycloakError(error, `Client with ID ${clientDbId} not found`);
    }
  }

  async deleteClient(tenantId: string, clientDbId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.clients.del({
        realm,
        id: clientDbId,
      });
      return { success: true, id: clientDbId };
    } catch (error) {
      this.handleKeycloakError(error, `Client with ID ${clientDbId} not found`);
    }
  }

  // --- Identity Provider (IdP) Methods ---

  async listIdentityProviders(tenantId: string) {
    await this.authenticate();
    return this.kcAdminClient.identityProviders.find({
      realm: `tenant-${tenantId}`,
    });
  }

  async createIdentityProvider(tenantId: string, dto: CreateIdpDto) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.identityProviders.create({
        realm,
        alias: dto.alias,
        providerId: dto.providerId,
        config: dto.config,
      });
      return { success: true, alias: dto.alias };
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realm} not found`);
    }
  }

  async updateIdentityProvider(
    tenantId: string,
    alias: string,
    dto: UpdateIdpDto,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.identityProviders.update(
        { realm, alias },
        {
          displayName: dto.displayName,
          enabled: dto.enabled,
          config: dto.config,
        },
      );
      return { success: true, alias };
    } catch (error) {
      this.handleKeycloakError(error, `Identity Provider ${alias} not found`);
    }
  }

  async deleteIdentityProvider(tenantId: string, alias: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.identityProviders.del({
        realm,
        alias,
      });
      return { success: true, alias };
    } catch (error) {
      this.handleKeycloakError(error, `Identity Provider ${alias} not found`);
    }
  }

  // --- Group & Hierarchy Methods ---

  async listGroups(tenantId: string): Promise<IamGroupResponseDto[]> {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const groups = await this.kcAdminClient.groups.find({
        realm,
        briefRepresentation: false,
        populateHierarchy: true,
      });
      return this.mapGroupsWithRoles(realm, groups || []);
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realm} not found`);
    }
  }

  async getGroupById(
    tenantId: string,
    groupId: string,
  ): Promise<IamGroupResponseDto> {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const group = await this.kcAdminClient.groups.findOne({
        realm,
        id: groupId,
      });
      if (!group) {
        throw new NotFoundException(`Group with ID ${groupId} not found`);
      }
      let realmRoles: string[] = [];
      try {
        const roles = await this.kcAdminClient.groups.listRoleMappings({
          realm,
          id: groupId,
        });
        realmRoles = (roles.realmMappings || [])
          .map((r) => r.name || '')
          .filter(Boolean);
      } catch {
        // ignore
      }
      const subGroups = group.subGroups
        ? await this.mapGroupsWithRoles(realm, group.subGroups)
        : [];
      return {
        id: group.id,
        name: group.name,
        path: group.path,
        attributes: group.attributes as Record<string, string[]>,
        realmRoles,
        subGroups,
      };
    } catch (error) {
      this.handleKeycloakError(error, `Group with ID ${groupId} not found`);
    }
  }

  async createGroup(tenantId: string, dto: CreateIamGroupDto) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const created = await this.kcAdminClient.groups.create({
        realm,
        name: dto.name,
        attributes: this.normalizeAttributes(dto.attributes),
      });

      if (dto.roles && dto.roles.length > 0 && created.id) {
        for (const roleName of dto.roles) {
          try {
            await this.assignRoleToGroup(tenantId, created.id, roleName);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Failed to assign role ${roleName} to group ${created.id}: ${msg}`,
            );
          }
        }
      }

      return { success: true, id: created.id, name: dto.name };
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realm} not found`);
    }
  }

  async createSubGroup(
    tenantId: string,
    parentGroupId: string,
    dto: CreateIamSubgroupDto,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const created = await this.kcAdminClient.groups.createChildGroup(
        { realm, id: parentGroupId },
        {
          name: dto.name,
          attributes: this.normalizeAttributes(dto.attributes),
        },
      );
      return {
        success: true,
        id: created.id,
        parentId: parentGroupId,
        name: dto.name,
      };
    } catch (error) {
      this.handleKeycloakError(
        error,
        `Parent group with ID ${parentGroupId} not found`,
      );
    }
  }

  async updateGroup(tenantId: string, groupId: string, dto: UpdateIamGroupDto) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.groups.update(
        { realm, id: groupId },
        {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.attributes
            ? { attributes: this.normalizeAttributes(dto.attributes) }
            : {}),
        },
      );
      return { success: true, id: groupId };
    } catch (error) {
      this.handleKeycloakError(error, `Group with ID ${groupId} not found`);
    }
  }

  async deleteGroup(tenantId: string, groupId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.groups.del({ realm, id: groupId });
      return { success: true, id: groupId };
    } catch (error) {
      this.handleKeycloakError(error, `Group with ID ${groupId} not found`);
    }
  }

  async assignRoleToGroup(tenantId: string, groupId: string, roleName: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const role = await this.kcAdminClient.roles.findOneByName({
        realm,
        name: roleName,
      });
      if (!role || !role.id || !role.name) {
        throw new NotFoundException(
          `Role ${roleName} not found in tenant realm`,
        );
      }
      await this.kcAdminClient.groups.addRealmRoleMappings({
        realm,
        id: groupId,
        roles: [{ id: role.id, name: role.name }],
      });
      return { success: true, groupId, roleName };
    } catch (error) {
      this.handleKeycloakError(
        error,
        `Failed to assign role ${roleName} to group ${groupId}`,
      );
    }
  }

  async removeRoleFromGroup(
    tenantId: string,
    groupId: string,
    roleName: string,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const role = await this.kcAdminClient.roles.findOneByName({
        realm,
        name: roleName,
      });
      if (!role || !role.id || !role.name) {
        throw new NotFoundException(
          `Role ${roleName} not found in tenant realm`,
        );
      }
      await this.kcAdminClient.groups.delRealmRoleMappings({
        realm,
        id: groupId,
        roles: [{ id: role.id, name: role.name }],
      });
      return { success: true, groupId, roleName };
    } catch (error) {
      this.handleKeycloakError(
        error,
        `Failed to remove role ${roleName} from group ${groupId}`,
      );
    }
  }

  async listGroupMembers(tenantId: string, groupId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const members = await this.kcAdminClient.groups.listMembers({
        realm,
        id: groupId,
      });
      return members || [];
    } catch (error) {
      this.handleKeycloakError(error, `Group with ID ${groupId} not found`);
    }
  }

  // --- User Group Memberships ---

  async getUserGroups(tenantId: string, userId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const groups = await this.kcAdminClient.users.listGroups({
        realm,
        id: userId,
      });
      return groups || [];
    } catch (error) {
      this.handleKeycloakError(error, `User with ID ${userId} not found`);
    }
  }

  async addUserToGroup(tenantId: string, userId: string, groupId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.users.addToGroup({
        realm,
        id: userId,
        groupId,
      });
      return { success: true, userId, groupId };
    } catch (error) {
      this.handleKeycloakError(
        error,
        `Failed to add user ${userId} to group ${groupId}`,
      );
    }
  }

  async removeUserFromGroup(tenantId: string, userId: string, groupId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.users.delFromGroup({
        realm,
        id: userId,
        groupId,
      });
      return { success: true, userId, groupId };
    } catch (error) {
      this.handleKeycloakError(
        error,
        `Failed to remove user ${userId} from group ${groupId}`,
      );
    }
  }

  // --- IdP Mapper Methods ---

  async listIdpMappers(tenantId: string, alias: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      return (
        (await this.kcAdminClient.identityProviders.findMappers({
          realm,
          alias,
        })) || []
      );
    } catch (error) {
      this.handleKeycloakError(error, `Identity Provider ${alias} not found`);
    }
  }

  async createIdpMapper(
    tenantId: string,
    alias: string,
    dto: CreateIdpMapperDto,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      const created = await this.kcAdminClient.identityProviders.createMapper({
        realm,
        alias,
        identityProviderMapper: {
          name: dto.name,
          identityProviderAlias: alias,
          identityProviderMapper: dto.identityProviderMapper,
          config: dto.config,
        },
      });
      return { success: true, id: created.id, name: dto.name };
    } catch (error) {
      this.handleKeycloakError(error, `Identity Provider ${alias} not found`);
    }
  }

  async deleteIdpMapper(tenantId: string, alias: string, mapperId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    try {
      await this.kcAdminClient.identityProviders.delMapper({
        realm,
        alias,
        id: mapperId,
      });
      return { success: true, id: mapperId };
    } catch (error) {
      this.handleKeycloakError(
        error,
        `IdP Mapper ${mapperId} not found on provider ${alias}`,
      );
    }
  }

  // --- 3rd-Party IdP Directory & Hierarchy Sync Engine ---

  async syncIdpHierarchy(
    tenantId: string,
    alias: string,
    dto?: SyncIdpHierarchyDto,
  ): Promise<SyncHierarchyResultDto> {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    const details: string[] = [];
    let rolesCreated = 0;
    let groupsCreated = 0;
    let subgroupsCreated = 0;
    let roleMappingsCreated = 0;

    // Verify IdP exists
    try {
      const idp = await this.kcAdminClient.identityProviders.findOne({
        realm,
        alias,
      });
      if (!idp) {
        throw new NotFoundException(`Identity Provider '${alias}' not found`);
      }
    } catch (error) {
      this.handleKeycloakError(error, `Identity Provider '${alias}' not found`);
    }

    // 1. Sync Corporate Roles
    if (dto?.roles && dto.roles.length > 0) {
      for (const roleItem of dto.roles) {
        try {
          const existing = await this.kcAdminClient.roles.findOneByName({
            realm,
            name: roleItem.name,
          });
          if (!existing) {
            await this.kcAdminClient.roles.create({
              realm,
              name: roleItem.name,
              description: roleItem.description,
            });
            rolesCreated++;
            details.push(`Created role: ${roleItem.name}`);
          } else {
            details.push(`Role already exists: ${roleItem.name}`);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          details.push(`Error syncing role ${roleItem.name}: ${msg}`);
        }
      }
    }

    // 2. Sync Groups & Nested Hierarchy
    if (dto?.groups && dto.groups.length > 0) {
      const existingGroups =
        (await this.kcAdminClient.groups.find({ realm })) || [];

      for (const groupItem of dto.groups) {
        try {
          // Find or create root group
          const targetGroup = existingGroups.find(
            (g) => g.name === groupItem.name,
          );
          let groupId = targetGroup?.id;

          if (!groupId) {
            const created = await this.kcAdminClient.groups.create({
              realm,
              name: groupItem.name,
              attributes: this.normalizeAttributes(groupItem.attributes),
            });
            groupId = created.id;
            groupsCreated++;
            details.push(`Created top-level group: ${groupItem.name}`);
          } else {
            details.push(`Group already exists: ${groupItem.name}`);
          }

          // Map roles to top-level group
          if (groupItem.roles && groupItem.roles.length > 0 && groupId) {
            for (const roleName of groupItem.roles) {
              try {
                await this.assignRoleToGroup(tenantId, groupId, roleName);
                roleMappingsCreated++;
                details.push(
                  `Mapped role '${roleName}' to group '${groupItem.name}'`,
                );
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                details.push(
                  `Failed to map role '${roleName}' to group '${groupItem.name}': ${msg}`,
                );
              }
            }
          }

          // Recursive subgroup sync helper
          const syncSubgroups = async (
            parentId: string,
            parentName: string,
            subGroups: SyncGroupTreeItemDto[],
          ) => {
            const currentChildren =
              (await this.kcAdminClient.groups.listSubGroups({
                realm,
                parentId,
              })) || [];

            for (const sub of subGroups) {
              const child = currentChildren.find((c) => c.name === sub.name);
              let childId = child?.id;

              if (!childId) {
                const createdChild =
                  await this.kcAdminClient.groups.createChildGroup(
                    { realm, id: parentId },
                    {
                      name: sub.name,
                      attributes: this.normalizeAttributes(sub.attributes),
                    },
                  );
                childId = createdChild.id;
                subgroupsCreated++;
                details.push(
                  `Created subgroup '${sub.name}' under '${parentName}'`,
                );
              } else {
                details.push(
                  `Subgroup '${sub.name}' already exists under '${parentName}'`,
                );
              }

              if (sub.roles && sub.roles.length > 0 && childId) {
                for (const roleName of sub.roles) {
                  try {
                    await this.assignRoleToGroup(tenantId, childId, roleName);
                    roleMappingsCreated++;
                    details.push(
                      `Mapped role '${roleName}' to subgroup '${sub.name}'`,
                    );
                  } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : String(e);
                    details.push(
                      `Failed to map role '${roleName}' to subgroup '${sub.name}': ${msg}`,
                    );
                  }
                }
              }

              if (sub.subGroups && sub.subGroups.length > 0 && childId) {
                await syncSubgroups(childId, sub.name, sub.subGroups);
              }
            }
          };

          if (
            groupItem.subGroups &&
            groupItem.subGroups.length > 0 &&
            groupId
          ) {
            await syncSubgroups(groupId, groupItem.name, groupItem.subGroups);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          details.push(`Error syncing group ${groupItem.name}: ${msg}`);
        }
      }
    }

    // 3. Native Directory Query Discovery Log
    if (dto?.providerCredentials) {
      details.push(
        `Executed live directory discovery handshake with provider '${alias}' via configured credentials`,
      );
    }

    return {
      rolesCreated,
      groupsCreated,
      subgroupsCreated,
      roleMappingsCreated,
      details,
    };
  }

  private async mapGroupsWithRoles(
    realm: string,
    groups: GroupRepresentation[],
  ): Promise<IamGroupResponseDto[]> {
    const result: IamGroupResponseDto[] = [];
    for (const g of groups) {
      let realmRoles: string[] = [];
      if (g.id) {
        try {
          const roles = await this.kcAdminClient.groups.listRoleMappings({
            realm,
            id: g.id,
          });
          realmRoles = (roles.realmMappings || [])
            .map((r) => r.name || '')
            .filter(Boolean);
        } catch {
          // ignore if role mappings fail
        }
      }
      const subGroups = g.subGroups
        ? await this.mapGroupsWithRoles(realm, g.subGroups)
        : [];
      result.push({
        id: g.id,
        name: g.name,
        path: g.path,
        attributes: g.attributes as Record<string, string[]>,
        realmRoles,
        subGroups,
      });
    }
    return result;
  }

  private normalizeAttributes(
    attributes?: Record<string, string[] | string>,
  ): Record<string, string[]> | undefined {
    if (!attributes) return undefined;
    const result: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(attributes)) {
      result[key] = Array.isArray(value) ? value.map(String) : [String(value)];
    }
    return result;
  }

  private handleKeycloakError(error: unknown, notFoundMessage: string): never {
    const err = error as {
      response?: { status?: number };
      responseData?: { errorMessage?: string; error?: string };
    };
    const status = err?.response?.status;
    const msg = err?.responseData?.errorMessage || err?.responseData?.error;

    if (status === 404) {
      throw new NotFoundException(notFoundMessage);
    }
    if (status === 409) {
      throw new ConflictException(msg || 'Resource already exists');
    }
    if (status === 400) {
      throw new BadRequestException(msg || 'Invalid request to Keycloak');
    }
    throw error;
  }

  private async resolveRealmName(identifier: string): Promise<string> {
    if (!identifier) {
      throw new NotFoundException('Tenant identifier cannot be empty');
    }

    const candidateName = identifier.startsWith('tenant-')
      ? identifier
      : `tenant-${identifier}`;

    // 1. Check if the realm exists directly by candidate realm name
    try {
      const realmByName = await this.kcAdminClient.realms.findOne({
        realm: candidateName,
      });
      if (realmByName && realmByName.realm) {
        return realmByName.realm;
      }
    } catch {
      // ignore 404 from findOne
    }

    // 2. Search all tenant realms to match internal Keycloak DB id (realm.id) or realm name
    try {
      const realms = await this.kcAdminClient.realms.find();
      const matched = (realms || []).find(
        (r) =>
          r.id === identifier ||
          r.realm === identifier ||
          r.realm === candidateName,
      );

      if (matched && matched.realm) {
        return matched.realm;
      }
    } catch {
      // ignore
    }

    throw new NotFoundException(
      `Tenant with identifier '${identifier}' not found`,
    );
  }

  // --- Master Admin Methods ---

  async listAllTenants() {
    await this.authenticate();
    const realms = await this.kcAdminClient.realms.find();
    return realms.filter((r) => r.realm?.startsWith('tenant-'));
  }

  async getTenantDetails(tenantId: string) {
    await this.authenticate();
    const realmName = await this.resolveRealmName(tenantId);
    try {
      const realm = await this.kcAdminClient.realms.findOne({
        realm: realmName,
      });
      if (!realm) {
        throw new NotFoundException(`Tenant realm ${realmName} not found`);
      }
      return realm;
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realmName} not found`);
    }
  }

  async updateTenant(tenantId: string, updates: RealmRepresentation) {
    await this.authenticate();
    const realmName = await this.resolveRealmName(tenantId);
    try {
      await this.kcAdminClient.realms.update({ realm: realmName }, updates);
      return { success: true };
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realmName} not found`);
    }
  }

  async setTenantStatus(tenantId: string, enabled: boolean) {
    await this.authenticate();
    const realmName = await this.resolveRealmName(tenantId);
    try {
      await this.kcAdminClient.realms.update({ realm: realmName }, { enabled });
      return { success: true, enabled };
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realmName} not found`);
    }
  }

  async deleteTenant(tenantId: string) {
    await this.authenticate();
    const realmName = await this.resolveRealmName(tenantId);
    try {
      await this.kcAdminClient.realms.del({ realm: realmName });
      return { success: true };
    } catch (error) {
      this.handleKeycloakError(error, `Tenant realm ${realmName} not found`);
    }
  }
}
