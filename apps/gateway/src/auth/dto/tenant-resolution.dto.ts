import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class TenantResolutionQueryDto {
  @ApiProperty({
    example: 'acme.com',
    description:
      'The corporate domain name (e.g. acme.com) or work email address (e.g. user@acme.com)',
  })
  @IsString()
  @IsNotEmpty()
  domain: string;
}

export class TenantResolutionResponseDto {
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
    description: 'Keycloak realm identifier',
  })
  realm: string;

  @ApiProperty({
    example: 'gini-frontend',
    description: 'Frontend client ID for OIDC authentication',
  })
  clientId: string;

  @ApiProperty({
    example: 'http://localhost:8080/realms/tenant-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: 'Keycloak issuer URL for OIDC discovery',
  })
  keycloakUrl: string;

  @ApiPropertyOptional({
    example: 'gini-theme',
    description: 'Configured login theme for the tenant realm',
  })
  loginTheme?: string;
}
