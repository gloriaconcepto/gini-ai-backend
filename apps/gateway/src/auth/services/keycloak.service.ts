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
import {
  CreateIamUserDto,
  UpdateIamUserDto,
  ResetPasswordDto,
  CreateIamRoleDto,
  CreateIamClientDto,
  CreateIdpDto,
  UpdateIdpDto,
} from '../dto/iam.dtos';

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private kcAdminClient: KcAdminClient;

  constructor(private configService: ConfigService) {
    this.kcAdminClient = new KcAdminClient({
      baseUrl: this.configService.get<string>(
        'KEYCLOAK_URL',
        'http://localhost:8080',
      ),
      realmName: 'master',
    });
  }

  private async authenticate(forceRefresh = false) {
    const clientId = this.configService.getOrThrow<string>(
      'KEYCLOAK_ADMIN_CLIENT_ID',
    );
    const clientSecret = this.configService.getOrThrow<string>(
      'KEYCLOAK_ADMIN_CLIENT_SECRET',
    );
    const baseUrl = this.configService.get<string>(
      'KEYCLOAK_URL',
      'http://localhost:8080',
    );

    if (
      !forceRefresh &&
      this.kcAdminClient.accessToken &&
      !this.kcAdminClient.isTokenExpired()
    ) {
      return;
    }

    try {
      const tokenUrl = `${baseUrl}/realms/master/protocol/openid-connect/token`;
      const params = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Keycloak token endpoint responded with status ${response.status}: ${errorBody}`,
        );
      }

      const data = (await response.json()) as { access_token: string };
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
    adminEmail?: string,
    adminPassword?: string,
    attributes?: Record<string, string>,
  ) {
    try {
      await this.authenticate();

      const realmName = `tenant-${tenantId}`;

      // 1. Create the new tenant realm
      await this.kcAdminClient.realms.create({
        realm: realmName,
        displayName: tenantName,
        enabled: true,
        loginTheme: 'gini-theme',
        accountTheme: 'gini-theme',
        adminTheme: 'gini-theme',
        emailTheme: 'gini-theme',
        attributes: attributes || {},
      });

      this.logger.log(`Provisioned new realm: ${realmName}`);

      // Refresh admin token so it contains the audience & permissions for the newly created realm
      await this.authenticate(true);

      // 2. Pre-provision standard governance roles for Gini Platform
      const standardRoles = [
        { name: 'admin', description: 'Tenant Administrator' },
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
      ];

      for (const role of standardRoles) {
        await this.kcAdminClient.roles.create({
          realm: realmName,
          name: role.name,
          description: role.description,
        });
      }

      // 3. Provision default SPA Frontend Client & Mock Dashboard Client
      const clientConfigs = [
        { clientId: 'gini-frontend', name: 'Gini Frontend SPA' },
        { clientId: 'giniai-dashboard-mock', name: 'Gini Mock Dashboard' },
      ];

      for (const clientCfg of clientConfigs) {
        await this.kcAdminClient.clients.create({
          realm: realmName,
          clientId: clientCfg.clientId,
          name: clientCfg.name,
          publicClient: true,
          directAccessGrantsEnabled: true,
          standardFlowEnabled: true,
          redirectUris: ['*'],
          webOrigins: ['*'],
          attributes: {
            'pkce.code.challenge.method': 'S256',
            'post.logout.redirect.uris': '*',
          },
        });
      }

      // 4. Create default tenant admin user if credentials provided
      if (adminEmail && adminPassword) {
        const user = await this.kcAdminClient.users.create({
          realm: realmName,
          username: adminEmail,
          email: adminEmail,
          firstName: 'Admin',
          lastName: 'User',
          enabled: true,
          emailVerified: true,
          requiredActions: [],
          credentials: [
            {
              type: 'password',
              value: adminPassword,
              temporary: false,
            },
          ],
        });

        const adminRole = await this.kcAdminClient.roles.findOneByName({
          realm: realmName,
          name: 'admin',
        });

        if (adminRole && adminRole.id && adminRole.name) {
          await this.kcAdminClient.users.addRealmRoleMappings({
            realm: realmName,
            id: user.id,
            roles: [
              {
                id: adminRole.id,
                name: adminRole.name,
              },
            ],
          });
          this.logger.log(
            `Provisioned default admin user (${adminEmail}) with 'admin' role in ${realmName}`,
          );
        }
      }

      return { success: true, realm: realmName };
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
    const user = await this.kcAdminClient.users.findOne({
      realm,
      id: userId,
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return user;
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
