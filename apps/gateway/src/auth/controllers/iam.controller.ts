import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KeycloakService } from '../services/keycloak.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import type { Request as ExpressRequest } from 'express';

type AuthRequest = ExpressRequest & { user: AuthenticatedUser };
import {
  CreateIamUserDto,
  CreateIamRoleDto,
  AssignRoleDto,
  CreateIamClientDto,
  CreateIdpDto,
} from '../dto/iam.dtos';

@ApiTags('Tenant IAM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('iam')
export class IamController {
  constructor(private readonly keycloakService: KeycloakService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users in the tenant realm' })
  async getUsers(@Request() req: AuthRequest) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.getUsers(tenantId);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new user in the tenant realm' })
  async createUser(@Request() req: AuthRequest, @Body() dto: CreateIamUserDto) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.createUser(tenantId, dto);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a new custom role in the tenant realm' })
  async createRole(@Request() req: AuthRequest, @Body() dto: CreateIamRoleDto) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.createRole(tenantId, dto);
  }

  @Post('users/:userId/roles')
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRole(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.assignRoleToUser(
      tenantId,
      userId,
      dto.roleName,
    );
  }

  @Post('clients')
  @ApiOperation({ summary: 'Register a new OAuth/OIDC client' })
  async createClient(
    @Request() req: AuthRequest,
    @Body() dto: CreateIamClientDto,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.createClient(tenantId, dto);
  }

  @Post('idp')
  @ApiOperation({ summary: 'Register a 3rd-party Identity Provider' })
  async createIdp(@Request() req: AuthRequest, @Body() dto: CreateIdpDto) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.createIdentityProvider(tenantId, dto);
  }
}
