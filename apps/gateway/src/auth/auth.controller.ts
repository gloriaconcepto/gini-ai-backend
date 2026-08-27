import { Controller, Post, Body, Res } from '@nestjs/common';
import type { Response } from 'express';
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
  @ApiResponse({ 
    status: 201, 
    description: 'The tenant realm has been successfully provisioned.',
    headers: {
      'X-Tenant-ID': {
        description: 'The unique ID of the newly created tenant',
        schema: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 500, description: 'Failed to provision tenant realm.' })
  async createTenant(@Body() body: CreateTenantDto, @Res({ passthrough: true }) res: Response) {
    const tenantId = randomUUID();
    const attributes: Record<string, string> = {};
    if (body.industry) attributes.industry = body.industry;
    if (body.domainName) attributes.domainName = body.domainName;
    if (body.subscriptionTier) attributes.subscriptionTier = body.subscriptionTier;
    if (body.taxId) attributes.taxId = body.taxId;
    if (body.billingAddress) attributes.billingAddress = body.billingAddress;
    if (body.contactPhone) attributes.contactPhone = body.contactPhone;

    const result = await this.keycloakService.provisionTenantRealm(
      tenantId,
      body.tenantName,
      body.adminEmail,
      body.adminPassword,
      attributes,
    );
    res.header('X-Tenant-ID', tenantId);
    return result;
  }
}

