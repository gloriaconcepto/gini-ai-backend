import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KeycloakService } from './keycloak.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { MasterAdminGuard } from './master-admin.guard';

import RealmRepresentation from '@keycloak/keycloak-admin-client/lib/defs/realmRepresentation';

@ApiTags('System Admin (Master)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, MasterAdminGuard)
@Controller('system/tenants')
export class SystemController {
  constructor(private readonly keycloakService: KeycloakService) {}

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
