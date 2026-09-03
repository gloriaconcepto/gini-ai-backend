import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { KeycloakService } from '../services/keycloak.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import type { Request as ExpressRequest } from 'express';

type AuthRequest = ExpressRequest & { user: AuthenticatedUser };
import {
  CreateIamUserDto,
  UpdateIamUserDto,
  ResetPasswordDto,
  CreateIamRoleDto,
  AssignRoleDto,
  CreateIamClientDto,
  CreateIdpDto,
  UpdateIdpDto,
  IamUserResponseDto,
} from '../dto/iam.dtos';

@ApiTags('Tenant IAM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('iam')
export class IamController {
  constructor(private readonly keycloakService: KeycloakService) {}

  // --- Users ---

  @Get('users')
  @ApiOperation({ summary: 'List all users in the tenant realm' })
  async getUsers(@Request() req: AuthRequest) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.getUsers(tenantId);
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get details of a specific user in the tenant realm',
  })
  @ApiResponse({
    status: 200,
    description: 'Details of the requested user including assigned roles',
    type: IamUserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found in tenant realm',
  })
  async getUser(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
  ): Promise<IamUserResponseDto> {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.getUserById(tenantId, userId);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a new user in the tenant realm' })
  async createUser(@Request() req: AuthRequest, @Body() dto: CreateIamUserDto) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.createUser(tenantId, dto);
  }

  @Patch('users/:userId')
  @ApiOperation({
    summary: 'Update profile and status of a user in the tenant realm',
  })
  async updateUser(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
    @Body() dto: UpdateIamUserDto,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.updateUser(tenantId, userId, dto);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Delete a user from the tenant realm' })
  async deleteUser(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.deleteUser(tenantId, userId);
  }

  @Put('users/:userId/reset-password')
  @ApiOperation({ summary: 'Reset a user password by tenant administrator' })
  async resetPassword(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.resetUserPassword(tenantId, userId, dto);
  }

  @Get('users/:userId/roles')
  @ApiOperation({ summary: 'List all realm roles assigned to a user' })
  async getUserRoles(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.getUserRoles(tenantId, userId);
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

  @Delete('users/:userId/roles/:roleName')
  @ApiOperation({ summary: 'Remove an assigned role from a user' })
  async removeRoleFromUser(
    @Request() req: AuthRequest,
    @Param('userId') userId: string,
    @Param('roleName') roleName: string,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.removeRoleFromUser(tenantId, userId, roleName);
  }

  // --- Roles ---

  @Get('roles')
  @ApiOperation({ summary: 'List all roles defined in the tenant realm' })
  async listRoles(@Request() req: AuthRequest) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.listRoles(tenantId);
  }

  @Post('roles')
  @ApiOperation({ summary: 'Create a new custom role in the tenant realm' })
  async createRole(@Request() req: AuthRequest, @Body() dto: CreateIamRoleDto) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.createRole(tenantId, dto);
  }

  @Delete('roles/:roleName')
  @ApiOperation({ summary: 'Delete a custom role from the tenant realm' })
  async deleteRole(
    @Request() req: AuthRequest,
    @Param('roleName') roleName: string,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.deleteRole(tenantId, roleName);
  }

  // --- Clients ---

  @Get('clients')
  @ApiOperation({ summary: 'List all OAuth/OIDC clients in the tenant realm' })
  async listClients(@Request() req: AuthRequest) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.listClients(tenantId);
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

  @Get('clients/:id/secret')
  @ApiOperation({
    summary: 'Retrieve credentials/client-secret for a confidential client',
  })
  async getClientSecret(@Request() req: AuthRequest, @Param('id') id: string) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.getClientSecret(tenantId, id);
  }

  @Delete('clients/:id')
  @ApiOperation({
    summary: 'Delete an OAuth/OIDC client from the tenant realm',
  })
  async deleteClient(@Request() req: AuthRequest, @Param('id') id: string) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.deleteClient(tenantId, id);
  }

  // --- Identity Providers (IdP) ---

  @Get('idp')
  @ApiOperation({
    summary: 'List all 3rd-party Identity Providers configured for the tenant',
  })
  async listIdps(@Request() req: AuthRequest) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.listIdentityProviders(tenantId);
  }

  @Post('idp')
  @ApiOperation({ summary: 'Register a 3rd-party Identity Provider' })
  async createIdp(@Request() req: AuthRequest, @Body() dto: CreateIdpDto) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.createIdentityProvider(tenantId, dto);
  }

  @Patch('idp/:alias')
  @ApiOperation({
    summary: 'Update a 3rd-party Identity Provider configuration',
  })
  async updateIdp(
    @Request() req: AuthRequest,
    @Param('alias') alias: string,
    @Body() dto: UpdateIdpDto,
  ) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.updateIdentityProvider(tenantId, alias, dto);
  }

  @Delete('idp/:alias')
  @ApiOperation({
    summary: 'Delete a 3rd-party Identity Provider from the tenant realm',
  })
  async deleteIdp(@Request() req: AuthRequest, @Param('alias') alias: string) {
    const tenantId = req.user.tenantId!;
    return this.keycloakService.deleteIdentityProvider(tenantId, alias);
  }
}
