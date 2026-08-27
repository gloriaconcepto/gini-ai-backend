import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { KeycloakService } from './keycloak.service';
import { AuthController } from './auth.controller';
import { IamController } from './iam.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    ConfigModule, // Assuming ConfigModule is globally imported in GatewayModule, but good to be explicit
  ],
  providers: [KeycloakService, JwtStrategy],
  controllers: [AuthController, IamController],
  exports: [KeycloakService],
})
export class AuthModule {}
