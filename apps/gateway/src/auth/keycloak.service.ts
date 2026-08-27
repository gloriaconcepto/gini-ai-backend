import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KcAdminClient from '@keycloak/keycloak-admin-client';

@Injectable()
export class KeycloakService {
  private readonly logger = new Logger(KeycloakService.name);
  private kcAdminClient: KcAdminClient;

  constructor(private configService: ConfigService) {
    this.kcAdminClient = new KcAdminClient({
      baseUrl: this.configService.get<string>('KEYCLOAK_URL', 'http://localhost:8080'),
      realmName: 'master',
    });
  }

  private async authenticate() {
    await this.kcAdminClient.auth({
      username: this.configService.get<string>('KEYCLOAK_ADMIN', 'admin'),
      password: this.configService.get<string>('KEYCLOAK_ADMIN_PASSWORD', 'admin'),
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
      
      // Create the new realm
      await this.kcAdminClient.realms.create({
        realm: realmName,
        displayName: tenantName,
        enabled: true,
        attributes: attributes || {},
      });

      this.logger.log(`Provisioned new realm: ${realmName}`);

      // Create a custom 'admin' role in the new realm for Gateway RBAC
      await this.kcAdminClient.roles.create({
        realm: realmName,
        name: 'admin',
        description: 'Tenant Administrator',
      });

      if (adminEmail && adminPassword) {
        // Create the default admin user
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

        // Assign the 'admin' role to the newly created user
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
          this.logger.log(`Provisioned default admin user (${adminEmail}) with 'admin' role in ${realmName}`);
        }
      }

      return { success: true, realm: realmName };
    } catch (error: any) {
      this.logger.error(`Failed to provision realm for tenant ${tenantId}`, error.stack);
      throw error;
    }
  }

  async getUsers(tenantId: string) {
    await this.authenticate();
    return this.kcAdminClient.users.find({ realm: `tenant-${tenantId}` });
  }

  async createUser(tenantId: string, dto: any) {
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

  async createRole(tenantId: string, dto: any) {
    await this.authenticate();
    await this.kcAdminClient.roles.create({
      realm: `tenant-${tenantId}`,
      name: dto.name,
      description: dto.description,
    });
    return { success: true, role: dto.name };
  }

  async assignRoleToUser(tenantId: string, userId: string, roleName: string) {
    await this.authenticate();
    const realm = `tenant-${tenantId}`;
    const role = await this.kcAdminClient.roles.findOneByName({ realm, name: roleName });
    if (!role || !role.id || !role.name) {
      throw new Error(`Role ${roleName} not found`);
    }
    await this.kcAdminClient.users.addRealmRoleMappings({
      realm,
      id: userId,
      roles: [{ id: role.id, name: role.name }],
    });
    return { success: true };
  }

  async createClient(tenantId: string, dto: any) {
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

  async createIdentityProvider(tenantId: string, dto: any) {
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

  // --- Master Admin Methods ---

  async listAllTenants() {
    await this.authenticate();
    const realms = await this.kcAdminClient.realms.find();
    return realms.filter(r => r.realm?.startsWith('tenant-'));
  }

  async getTenantDetails(tenantId: string) {
    await this.authenticate();
    const realmName = `tenant-${tenantId}`;
    return this.kcAdminClient.realms.findOne({ realm: realmName });
  }

  async updateTenant(tenantId: string, updates: any) {
    await this.authenticate();
    const realmName = `tenant-${tenantId}`;
    await this.kcAdminClient.realms.update({ realm: realmName }, updates);
    return { success: true };
  }

  async deleteTenant(tenantId: string) {
    await this.authenticate();
    const realmName = `tenant-${tenantId}`;
    await this.kcAdminClient.realms.del({ realm: realmName });
    return { success: true };
  }
}
