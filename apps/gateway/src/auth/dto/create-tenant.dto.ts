import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEmail, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ description: 'The display name of the tenant', example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  tenantName: string;

  @ApiProperty({ description: 'The email address of the default tenant administrator', example: 'admin@acme.com' })
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @ApiProperty({ description: 'The password for the default tenant administrator', example: 'securePassword123' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  adminPassword: string;
}

