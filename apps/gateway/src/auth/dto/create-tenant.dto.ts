import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class TenantProvisionedUserDto {
  @ApiProperty({
    example: 'user-uuid-1234',
    description: 'Unique Keycloak user ID',
  })
  id: string;

  @ApiProperty({
    example: 'maker@acme.com',
    description: 'Email address of the provisioned user',
  })
  email: string;

  @ApiProperty({
    example: 'maker@acme.com',
    description: 'Keycloak username of the provisioned user',
  })
  username: string;

  @ApiPropertyOptional({
    example: 'John',
    description: 'First name of the provisioned user',
  })
  firstName?: string;

  @ApiPropertyOptional({
    example: 'Doe',
    description: 'Last name of the provisioned user',
  })
  lastName?: string;

  @ApiProperty({
    example: ['maker', 'admin'],
    description: 'Assigned governance roles for the user',
    isArray: true,
    type: String,
  })
  roles: string[];
}

export class CreateTenantDto {
  @ApiProperty({
    description: 'The display name of the tenant',
    example: 'Acme Corp',
  })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiProperty({
    description: 'The email address of the default tenant maker',
    example: 'maker@acme.com',
  })
  @IsEmail()
  @IsNotEmpty()
  makerEmail: string;

  @ApiProperty({
    description: 'The password for the default tenant maker',
    example: 'securePassword123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  makerPassword: string;

  @ApiPropertyOptional({
    description: 'The first name of the default tenant maker',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  makerFirstName?: string;

  @ApiPropertyOptional({
    description: 'The last name of the default tenant maker',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  makerLastName?: string;

  @ApiProperty({
    description: 'The email address of the default tenant checker',
    example: 'checker@acme.com',
  })
  @IsEmail()
  @IsNotEmpty()
  checkerEmail: string;

  @ApiProperty({
    description: 'The password for the default tenant checker',
    example: 'securePassword123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  checkerPassword: string;

  @ApiPropertyOptional({
    description: 'The first name of the default tenant checker',
    example: 'Jane',
  })
  @IsString()
  @IsOptional()
  checkerFirstName?: string;

  @ApiPropertyOptional({
    description: 'The last name of the default tenant checker',
    example: 'Smith',
  })
  @IsString()
  @IsOptional()
  checkerLastName?: string;

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
    description: 'Provisioned Maker user details',
    type: TenantProvisionedUserDto,
  })
  maker: TenantProvisionedUserDto;

  @ApiProperty({
    description: 'Provisioned Checker user details',
    type: TenantProvisionedUserDto,
  })
  checker: TenantProvisionedUserDto;

  @ApiProperty({
    example: true,
    description: 'Whether the tenant realm is active and enabled',
  })
  enabled: boolean;

  @ApiProperty({
    example: ['maker', 'checker', 'auditor', 'user', 'admin'],
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
