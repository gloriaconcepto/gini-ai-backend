import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ApiKeyService } from '../services/api-key.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import { CreateApiKeyDto } from '../dto/iam.dtos';
import type { Request as ExpressRequest } from 'express';

type AuthRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Tenant API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('iam/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Generate a new API key for the tenant' })
  @ApiResponse({
    status: 201,
    description: 'The API key has been created. The raw apiKey is only displayed once upon creation.',
  })
  async createApiKey(
    @Request() req: AuthRequest,
    @Body() dto: CreateApiKeyDto,
  ) {
    const tenantId = req.user.tenantId!;
    return this.apiKeyService.generateApiKey(
      tenantId,
      dto.name,
      dto.expiresInDays,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List all API keys (metadata) for the tenant' })
  async listApiKeys(@Request() req: AuthRequest) {
    const tenantId = req.user.tenantId!;
    return this.apiKeyService.listApiKeys(tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an existing API key' })
  async revokeApiKey(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ) {
    const tenantId = req.user.tenantId!;
    return this.apiKeyService.revokeApiKey(tenantId, id);
  }
}
