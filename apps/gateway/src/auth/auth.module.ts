import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { KeycloakService } from './services/keycloak.service';
import { ApiKeyService } from './services/api-key.service';
import { TenantDomainService } from './services/tenant-domain.service';
import { ChangeRequestStoreService } from './services/change-request-store.service';
import { ChangeRequestExecutorService } from './services/change-request-executor.service';
import { MakerCheckerInterceptor } from './interceptors/maker-checker.interceptor';
import { IamController } from './controllers/iam.controller';
import { SystemController } from './controllers/system.controller';
import { ApiKeyController } from './controllers/api-key.controller';
import { TenantController } from './controllers/tenant.controller';
import { GovernanceController } from './controllers/governance.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [PassportModule, ConfigModule],
  providers: [
    KeycloakService,
    ApiKeyService,
    TenantDomainService,
    ChangeRequestStoreService,
    ChangeRequestExecutorService,
    MakerCheckerInterceptor,
    JwtStrategy,
    ApiKeyGuard,
  ],
  controllers: [
    IamController,
    SystemController,
    ApiKeyController,
    TenantController,
    GovernanceController,
  ],
  exports: [
    KeycloakService,
    ApiKeyService,
    TenantDomainService,
    ChangeRequestStoreService,
    ChangeRequestExecutorService,
    MakerCheckerInterceptor,
    ApiKeyGuard,
  ],
})
export class AuthModule {}
