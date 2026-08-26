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

  async provisionTenantRealm(tenantId: string, tenantName: string) {
    try {
      await this.authenticate();
      
      const realmName = `tenant-${tenantId}`;
      
      // Create the new realm
      await this.kcAdminClient.realms.create({
        realm: realmName,
        displayName: tenantName,
        enabled: true,
      });

      this.logger.log(`Provisioned new realm: ${realmName}`);
      return { success: true, realm: realmName };
    } catch (error: any) {
      this.logger.error(`Failed to provision realm for tenant ${tenantId}`, error.stack);
      throw error;
    }
  }
}
