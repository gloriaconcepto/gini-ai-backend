import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { KeycloakService } from './services/keycloak.service';
import { ApiKeyService } from './services/api-key.service';
import { IamController } from './controllers/iam.controller';
import { SystemController } from './controllers/system.controller';
import { ApiKeyController } from './controllers/api-key.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
  ],
  providers: [KeycloakService, ApiKeyService, JwtStrategy, ApiKeyGuard],
  controllers: [IamController, SystemController, ApiKeyController],
  exports: [KeycloakService, ApiKeyService, ApiKeyGuard],
})
export class AuthModule {}
