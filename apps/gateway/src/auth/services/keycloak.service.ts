import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
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

  private async authenticate() {
    await this.kcAdminClient.auth({
      username: this.configService.get<string>('KEYCLOAK_ADMIN', 'admin'),
      password: this.configService.get<string>(
        'KEYCLOAK_ADMIN_PASSWORD',
        'admin',
      ),
      grantType: 'password',
      clientId: 'admin-cli',
    });
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
        attributes: attributes || {},
      });

      this.logger.log(`Provisioned new realm: ${realmName}`);

      // 2. Pre-provision standard governance roles for Gini Platform
      const standardRoles = [
        { name: 'admin', description: 'Tenant Administrator' },
        { name: 'maker', description: 'Maker Role - Dual Control Submitter' },
        { name: 'checker', description: 'Checker Role - Dual Control Approver' },
        { name: 'auditor', description: 'System Auditor - Read Only Compliance' },
        { name: 'user', description: 'Standard Tenant User' },
      ];

      for (const role of standardRoles) {
        await this.kcAdminClient.roles.create({
          realm: realmName,
          name: role.name,
          description: role.description,
        });
      }

      // 3. Provision default SPA Frontend Client
      await this.kcAdminClient.clients.create({
        realm: realmName,
        clientId: 'gini-frontend',
        publicClient: true,
        directAccessGrantsEnabled: true,
        standardFlowEnabled: true,
        redirectUris: ['*'],
        webOrigins: ['*'],
      });

      // 4. Create default tenant admin user if credentials provided
      if (adminEmail && adminPassword) {
        const user = await this.kcAdminClient.users.create({
          realm: realmName,
          username: adminEmail,
          email: adminEmail,
          enabled: true,
          emailVerified: true,
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
      firstName: dto.firstName,
      lastName: dto.lastName,
      enabled: true,
      emailVerified: true,
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
  }

  async deleteUser(tenantId: string, userId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    await this.kcAdminClient.users.del({ realm, id: userId });
    return { success: true, userId };
  }

  async resetUserPassword(
    tenantId: string,
    userId: string,
    dto: ResetPasswordDto,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
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
  }

  async getUserRoles(tenantId: string, userId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    return this.kcAdminClient.users.listRealmRoleMappings({
      realm,
      id: userId,
    });
  }

  async removeRoleFromUser(
    tenantId: string,
    userId: string,
    roleName: string,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    const role = await this.kcAdminClient.roles.findOneByName({
      realm,
      name: roleName,
    });
    if (!role || !role.id || !role.name) {
      throw new NotFoundException(`Role ${roleName} not found`);
    }
    await this.kcAdminClient.users.delRealmRoleMappings({
      realm,
      id: userId,
      roles: [{ id: role.id, name: role.name }],
    });
    return { success: true };
  }

  // --- Role Management Methods ---

  async listRoles(tenantId: string) {
    await this.authenticate();
    return this.kcAdminClient.roles.find({ realm: `tenant-${tenantId}` });
  }

  async createRole(tenantId: string, dto: CreateIamRoleDto) {
    await this.authenticate();
    await this.kcAdminClient.roles.create({
      realm: `tenant-${tenantId}`,
      name: dto.name,
      description: dto.description,
    });
    return { success: true, role: dto.name };
  }

  async deleteRole(tenantId: string, roleName: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    await this.kcAdminClient.roles.delByName({
      realm,
      name: roleName,
    });
    return { success: true, role: roleName };
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
    await this.kcAdminClient.users.addRealmRoleMappings({
      realm,
      id: userId,
      roles: [{ id: role.id, name: role.name }],
    });
    return { success: true };
  }

  // --- Client Management Methods ---

  async listClients(tenantId: string) {
    await this.authenticate();
    return this.kcAdminClient.clients.find({ realm: `tenant-${tenantId}` });
  }

  async createClient(tenantId: string, dto: CreateIamClientDto) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    const client = await this.kcAdminClient.clients.create({
      realm,
      clientId: dto.clientId,
      publicClient: dto.publicClient,
      directAccessGrantsEnabled: dto.directAccessGrantsEnabled,
      redirectUris: dto.redirectUris,
      webOrigins: dto.webOrigins,
    });
    return client;
  }

  async getClientSecret(tenantId: string, clientDbId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    return this.kcAdminClient.clients.getClientSecret({
      realm,
      id: clientDbId,
    });
  }

  async deleteClient(tenantId: string, clientDbId: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    await this.kcAdminClient.clients.del({
      realm,
      id: clientDbId,
    });
    return { success: true, id: clientDbId };
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
    await this.kcAdminClient.identityProviders.create({
      realm,
      alias: dto.alias,
      providerId: dto.providerId,
      config: dto.config,
    });
    return { success: true, alias: dto.alias };
  }

  async updateIdentityProvider(
    tenantId: string,
    alias: string,
    dto: UpdateIdpDto,
  ) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    await this.kcAdminClient.identityProviders.update(
      { realm, alias },
      {
        displayName: dto.displayName,
        enabled: dto.enabled,
        config: dto.config,
      },
    );
    return { success: true, alias };
  }

  async deleteIdentityProvider(tenantId: string, alias: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    await this.kcAdminClient.identityProviders.del({
      realm,
      alias,
    });
    return { success: true, alias };
  }

  // --- Master Admin Methods ---

  async listAllTenants() {
    await this.authenticate();
    const realms = await this.kcAdminClient.realms.find();
    return realms.filter((r) => r.realm?.startsWith('tenant-'));
  }

  async getTenantDetails(tenantId: string) {
    await this.authenticate();
    const realmName = `tenant-${tenantId}`;
    const realm = await this.kcAdminClient.realms.findOne({ realm: realmName });
    if (!realm) {
      throw new NotFoundException(`Tenant realm ${realmName} not found`);
    }
    return realm;
  }

  async updateTenant(tenantId: string, updates: RealmRepresentation) {
    await this.authenticate();
    const realmName = `tenant-${tenantId}`;
    await this.kcAdminClient.realms.update({ realm: realmName }, updates);
    return { success: true };
  }

  async setTenantStatus(tenantId: string, enabled: boolean) {
    await this.authenticate();
    const realmName = `tenant-${tenantId}`;
    await this.kcAdminClient.realms.update(
      { realm: realmName },
      { enabled },
    );
    return { success: true, enabled };
  }

  async deleteTenant(tenantId: string) {
    await this.authenticate();
    const realmName = `tenant-${tenantId}`;
    await this.kcAdminClient.realms.del({ realm: realmName });
    return { success: true };
  }
}

