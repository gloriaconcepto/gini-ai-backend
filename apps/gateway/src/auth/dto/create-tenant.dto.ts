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
}
