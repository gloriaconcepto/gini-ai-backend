import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
} from 'class-validator';

export class CreateIamUserDto {
  @ApiProperty({ example: 'johndoe', description: 'Username for the new user' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'Email for the new user',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'John', description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    example: 'SecureP@ssw0rd',
    description: 'Initial password for the user',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CreateIamRoleDto {
  @ApiProperty({ example: 'auditor', description: 'Name of the role' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Read-only access to audit logs',
    description: 'Role description',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class AssignRoleDto {
  @ApiProperty({
    example: 'auditor',
    description: 'Name of the role to assign',
  })
  @IsString()
  @IsNotEmpty()
  roleName: string;
}

export class CreateIamClientDto {
  @ApiProperty({ example: 'my-frontend-app', description: 'Client ID' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: true, description: 'Is this a public client?' })
  @IsBoolean()
  publicClient: boolean;

  @ApiProperty({
    example: true,
    description: 'Enable direct access grants (password flow)',
  })
  @IsBoolean()
  directAccessGrantsEnabled: boolean;

  @ApiPropertyOptional({
    example: ['http://localhost:3000/*'],
    description: 'Allowed redirect URIs',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  redirectUris?: string[];

  @ApiPropertyOptional({
    example: ['http://localhost:3000'],
    description: 'Allowed Web Origins (CORS)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  webOrigins?: string[];
}

export class CreateIdpDto {
  @ApiProperty({
    example: 'google-sso',
    description: 'Alias for the Identity Provider',
  })
  @IsString()
  @IsNotEmpty()
  alias: string;

  @ApiProperty({
    example: 'google',
    description: 'Provider ID (e.g. google, oidc, saml)',
  })
  @IsString()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({
    example: { clientId: 'xxx', clientSecret: 'yyy' },
    description: 'Key-value config specific to the provider ID',
  })
  @IsObject()
  config: Record<string, string>;
}

export class UpdateIamUserDto {
  @ApiPropertyOptional({
    example: 'john@example.com',
    description: 'Updated email address',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'John', description: 'Updated first name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Updated last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the user account is enabled',
  })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'NewSecureP@ssw0rd',
    description: 'New password for the user',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Require user to change password on next login',
  })
  @IsBoolean()
  @IsOptional()
  temporary?: boolean;
}

export class UpdateIdpDto {
  @ApiPropertyOptional({
    example: 'Google Workspace SSO',
    description: 'Display name for IDP',
  })
  @IsString()
  @IsOptional()
  displayName?: string;

  @ApiPropertyOptional({ example: true, description: 'Enable or disable IDP' })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional({
    example: { clientId: 'xxx', clientSecret: 'yyy' },
    description: 'Updated IDP key-value configuration',
  })
  @IsObject()
  @IsOptional()
  config?: Record<string, string>;
}

export class TenantStatusDto {
  @ApiProperty({
    example: true,
    description: 'Set tenant realm status (enabled or disabled)',
  })
  @IsBoolean()
  enabled: boolean;
}

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Backend Ingestion Service',
    description: 'Name/label for the API Key',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 30,
    description: 'Expiration period in days (optional)',
  })
  @IsOptional()
  expiresInDays?: number;
}
