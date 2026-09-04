import {
  Controller,
  Get,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { KeycloakService } from '../services/keycloak.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthenticatedUser } from '../strategies/jwt.strategy';
import { TenantWorkspaceResponseDto } from '../dto/tenant-workspace.dto';

type AuthRequest = ExpressRequest & { user: AuthenticatedUser };

@ApiTags('Tenant Workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class TenantController {
  constructor(private readonly keycloakService: KeycloakService) {}

  @Get('workspace')
  @ApiOperation({
    summary:
      'Retrieve tenant workspace details and realm representation for the current authenticated user',
  })
  @ApiResponse({
    status: 200,
    description:
      'The workspace details and Keycloak realm representation for the authenticated tenant user.',
    type: TenantWorkspaceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing JWT token.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Forbidden - master/OEM administrators do not belong to a tenant workspace.',
  })
  @ApiResponse({
    status: 404,
    description: 'Tenant realm not found.',
  })
  async getWorkspace(
    @Request() req: AuthRequest,
  ): Promise<TenantWorkspaceResponseDto> {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException(
        'Master administrators do not belong to a tenant workspace',
      );
    }

    const realm = await this.keycloakService.getTenantDetails(tenantId);

    const getAttributeValue = (key: string): string | undefined => {
      const val = realm.attributes?.[key];
      if (Array.isArray(val)) {
        return val[0];
      }
      return typeof val === 'string' ? val : undefined;
    };

    return {
      tenantId,
      tenantName: realm.displayName || realm.realm || tenantId,
      realm: realm.realm || `tenant-${tenantId}`,
      enabled: realm.enabled ?? true,
      loginTheme: realm.loginTheme,
      accountTheme: realm.accountTheme,
      adminTheme: realm.adminTheme,
      emailTheme: realm.emailTheme,
      industry: getAttributeValue('industry'),
      domainName: getAttributeValue('domainName'),
      subscriptionTier: getAttributeValue('subscriptionTier') as
        | 'Basic'
        | 'Pro'
        | 'Enterprise'
        | undefined,
      taxId: getAttributeValue('taxId'),
      billingAddress: getAttributeValue('billingAddress'),
      contactPhone: getAttributeValue('contactPhone'),
      attributes: realm.attributes,
      currentUser: {
        userId: req.user.userId,
        username: req.user.username,
        roles: req.user.roles || [],
      },
    };
  }
}
