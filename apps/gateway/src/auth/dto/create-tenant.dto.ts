import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({
    description: 'The display name of the tenant',
    example: 'Acme Corp',
  })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiProperty({
    description: 'The email address of the default tenant administrator',
    example: 'admin@acme.com',
  })
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({
    description: 'The password for the default tenant administrator',
    example: 'securePassword123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  adminPassword: string;

  @ApiPropertyOptional({ example: 'Finance', description: 'Industry / Sector' })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({
    example: 'acme.com',
    description: 'Corporate Domain Name',
  })
  @IsString()
  @IsOptional()
  domainName?: string;

  @ApiPropertyOptional({
    example: 'Enterprise',
    description: 'Subscription Tier',
  })
  @IsEnum(['Basic', 'Pro', 'Enterprise'])
  @IsOptional()
  subscriptionTier?: 'Basic' | 'Pro' | 'Enterprise';

  @ApiPropertyOptional({
    example: '12-3456789',
    description: 'Company Registration Number / Tax ID',
  })
  @IsString()
  @IsOptional()
  taxId?: string;

  @ApiPropertyOptional({
    example: '123 Main St, USA',
    description: 'Billing Address / Country',
  })
  @IsString()
  @IsOptional()
  billingAddress?: string;

  @ApiPropertyOptional({
    example: '+1-555-0198',
    description: 'Primary Contact Phone Number',
  })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({
    example: 'gini-frontend',
    description:
      'Custom client ID for frontend application (defaults to gini-frontend)',
  })
  @IsString()
  @IsOptional()
  clientId?: string;
}

export class CreateTenantResponseDto {
  @ApiProperty({
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: 'Unique identifier for the tenant',
  })
  tenantId: string;

  @ApiProperty({
    example: 'Acme Corp',
    description: 'The display name of the tenant',
  })
  tenantName: string;

  @ApiProperty({
    example: 'tenant-9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    description: 'The provisioned Keycloak realm name',
  })
  realm: string;

  @ApiProperty({
    example: 'gini-frontend',
    description: 'The Keycloak client ID for frontend authentication',
  })
  clientId: string;

  @ApiProperty({
    example: 'admin@acme.com',
    description: 'Email address of the default tenant administrator',
  })
  adminEmail: string;

  @ApiProperty({
    example: true,
    description: 'Whether the tenant realm is active and enabled',
  })
  enabled: boolean;

  @ApiProperty({
    example: ['Maker', 'Checker', 'Auditor', 'User', 'Admin'],
    description: 'Default governance roles provisioned for the tenant',
    isArray: true,
    type: String,
  })
  roles: string[];

  @ApiPropertyOptional({
    example: 'Finance',
    description: 'Industry / Sector',
  })
  industry?: string;

  @ApiPropertyOptional({
    example: 'acme.com',
    description: 'Corporate Domain Name',
  })
  domainName?: string;

  @ApiPropertyOptional({
    example: 'Enterprise',
    description: 'Subscription Tier',
    enum: ['Basic', 'Pro', 'Enterprise'],
  })
  subscriptionTier?: 'Basic' | 'Pro' | 'Enterprise';

  @ApiPropertyOptional({
    example: '12-3456789',
    description: 'Company Registration Number / Tax ID',
  })
  taxId?: string;

  @ApiPropertyOptional({
    example: '123 Main St, USA',
    description: 'Billing Address / Country',
  })
  billingAddress?: string;

  @ApiPropertyOptional({
    example: '+1-555-0198',
    description: 'Primary Contact Phone Number',
  })
  contactPhone?: string;

  @ApiProperty({
    example: '2026-09-01T14:00:00.000Z',
    description: 'Timestamp when the tenant was provisioned',
  })
  createdAt: string;
}

export { CreateTenantResponseDto as TenantResponseDto };

