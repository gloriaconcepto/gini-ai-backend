import { Controller, Post, Body } from '@nestjs/common';
import { KeycloakService } from './keycloak.service';
import { Public } from './public.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { randomUUID } from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(private readonly keycloakService: KeycloakService) {}

  @Public()
  @Post('tenant')
  async createTenant(@Body() body: CreateTenantDto) {
    const tenantId = randomUUID();
    const result = await this.keycloakService.provisionTenantRealm(tenantId, body.tenantName);
    return { ...result, tenantId };
  }
}
