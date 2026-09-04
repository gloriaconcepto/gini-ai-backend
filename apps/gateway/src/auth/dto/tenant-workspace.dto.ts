import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WorkspaceCurrentUserDto {
  @ApiProperty({
    example: 'user-uuid-1234',
    description: 'Unique identifier of the authenticated user',
  })
  userId: string;

  @ApiProperty({
    example: 'alice@acme.com',
    description: 'Username / preferred email of the user',
  })
  username: string;

  @ApiProperty({
    example: ['user'],
    description: 'Roles assigned to the authenticated user within this realm',
    isArray: true,
    type: String,
  })
  roles: string[];
}

export class TenantWorkspaceResponseDto {
  @ApiProperty({
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: 'Unique identifier for the tenant',
  })
  tenantId: string;

  @ApiProperty({
    example: 'Acme Corp',
    description: 'Display name of the tenant workspace',
  })
  tenantName: string;

  @ApiProperty({
    example: 'tenant-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: 'Provisioned Keycloak realm identifier',
  })
  realm: string;

  @ApiProperty({
    example: true,
    description: 'Whether the tenant realm is active and enabled',
  })
  enabled: boolean;

  @ApiPropertyOptional({
    example: 'gini-theme',
    description: 'Keycloak login theme applied to the realm',
  })
  loginTheme?: string;

  @ApiPropertyOptional({
    example: 'gini-theme',
    description: 'Keycloak account theme applied to the realm',
  })
  accountTheme?: string;

  @ApiPropertyOptional({
    example: 'gini-theme',
    description: 'Keycloak admin console theme applied to the realm',
  })
  adminTheme?: string;

  @ApiPropertyOptional({
    example: 'gini-theme',
    description: 'Keycloak email theme applied to the realm',
  })
  emailTheme?: string;

  @ApiPropertyOptional({
    example: 'Finance',
    description: 'Corporate industry / sector',
  })
  industry?: string;

  @ApiPropertyOptional({
    example: 'acme.com',
    description: 'Corporate domain name',
  })
  domainName?: string;

  @ApiPropertyOptional({
    example: 'Enterprise',
    description: 'Subscription tier level',
    enum: ['Basic', 'Pro', 'Enterprise'],
  })
  subscriptionTier?: 'Basic' | 'Pro' | 'Enterprise';

  @ApiPropertyOptional({
    example: '12-3456789',
    description: 'Corporate tax ID / registration number',
  })
  taxId?: string;

  @ApiPropertyOptional({
    example: '123 Main St, USA',
    description: 'Billing address',
  })
  billingAddress?: string;

  @ApiPropertyOptional({
    example: '+1-555-0198',
    description: 'Primary contact phone number',
  })
  contactPhone?: string;

  @ApiPropertyOptional({
    description: 'Raw Keycloak realm attributes dictionary',
    type: Object,
  })
  attributes?: Record<string, any>;

  @ApiProperty({
    description: 'Authenticated user context details',
    type: WorkspaceCurrentUserDto,
  })
  currentUser: WorkspaceCurrentUserDto;
}
