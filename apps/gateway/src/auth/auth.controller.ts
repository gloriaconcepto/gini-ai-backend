import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KeycloakService } from './keycloak.service';
import { Public } from './public.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { randomUUID } from 'crypto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly keycloakService: KeycloakService) {}

  @Public()
  @Post('tenant')
  @ApiOperation({ summary: 'Provision a new tenant realm and API keys' })
  @ApiResponse({ status: 201, description: 'The tenant realm has been successfully provisioned.' })
  @ApiResponse({ status: 500, description: 'Failed to provision tenant realm.' })
  async createTenant(@Body() body: CreateTenantDto) {
    const tenantId = randomUUID();
    const result = await this.keycloakService.provisionTenantRealm(tenantId, body.tenantName);
    return { ...result, tenantId };
  }
}

