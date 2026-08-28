import {
  Controller,
  Get,
  Post,
  Param,
  Patch,
  Delete,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { KeycloakService } from '../services/keycloak.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { MasterAdminGuard } from '../guards/master-admin.guard';
import { CreateTenantDto } from '../dto/create-tenant.dto';

import type RealmRepresentation from '@keycloak/keycloak-admin-client/lib/defs/realmRepresentation';

@ApiTags('System Admin (Master)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MasterAdminGuard)
@Controller('system/tenants')
export class SystemController {
  constructor(private readonly keycloakService: KeycloakService) {}

  @Post()
  @ApiOperation({ summary: 'Provision a new tenant realm and API keys' })
  @ApiResponse({
    status: 201,
    description: 'The tenant realm has been successfully provisioned.',
    headers: {
      'X-Tenant-ID': {
        description: 'The unique ID of the newly created tenant',
        schema: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to provision tenant realm.',
  })
  async createTenant(
    @Body() body: CreateTenantDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenantId = randomUUID();
    const attributes: Record<string, string> = {};
    if (body.industry) attributes.industry = body.industry;
    if (body.domainName) attributes.domainName = body.domainName;
    if (body.subscriptionTier)
      attributes.subscriptionTier = body.subscriptionTier;
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

  @Get()
  @ApiOperation({ summary: 'List all provisioned tenant realms' })
  async listTenants() {
    return this.keycloakService.listAllTenants();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific tenant realm' })
  async getTenant(@Param('id') id: string) {
    return this.keycloakService.getTenantDetails(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update metadata for a specific tenant realm' })
  async updateTenant(
    @Param('id') id: string,
    @Body() updates: RealmRepresentation,
  ) {
    return this.keycloakService.updateTenant(id, updates);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tenant realm entirely' })
  async deleteTenant(@Param('id') id: string) {
    return this.keycloakService.deleteTenant(id);
  }
}
