import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { KeycloakService } from './keycloak.service';
import { IamController } from './iam.controller';
import { SystemController } from './system.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    ConfigModule, // Assuming ConfigModule is globally imported in GatewayModule, but good to be explicit
  ],
  providers: [KeycloakService, JwtStrategy],
  controllers: [IamController, SystemController],
  exports: [KeycloakService],
})
export class AuthModule {}
