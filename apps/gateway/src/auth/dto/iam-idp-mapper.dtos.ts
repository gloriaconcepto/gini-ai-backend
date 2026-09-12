import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIdpMapperDto {
  @ApiProperty({
    example: 'Azure AD Roles to Realm Roles',
    description: 'Descriptive name for the IdP claim mapper',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 'oidc-role-idp-mapper',
    description:
      'Keycloak IdP mapper type (e.g. oidc-role-idp-mapper, oidc-group-idp-mapper, oidc-user-attribute-idp-mapper, saml-role-idp-mapper)',
  })
  @IsString()
  @IsNotEmpty()
  identityProviderMapper: string;

  @ApiProperty({
    example: {
      claim: 'roles',
      'claim.value': 'Admin',
      role: 'admin',
      syncMode: 'FORCE',
    },
    description: 'Configuration dictionary for the specific mapper type',
  })
  @IsObject()
  config: Record<string, string>;
}

export class IdpMapperResponseDto {
  @ApiPropertyOptional({
    example: 'd9b9ef3e-436f-4279-99fc-77b31ee9c279',
    description: 'Unique mapper identifier in Keycloak',
  })
  id?: string;

  @ApiPropertyOptional({
    example: 'Azure AD Roles to Realm Roles',
    description: 'Name of the mapper',
  })
  name?: string;

  @ApiPropertyOptional({
    example: 'oidc-role-idp-mapper',
    description: 'Mapper type implementation in Keycloak',
  })
  identityProviderMapper?: string;

  @ApiPropertyOptional({
    example: 'azure-ad',
    description: 'Alias of the associated Identity Provider',
  })
  identityProviderAlias?: string;

  @ApiPropertyOptional({
    example: { claim: 'roles', role: 'admin' },
    description: 'Key-value mapper configuration',
  })
  config?: Record<string, string>;
}

export class SyncRoleItemDto {
  @ApiProperty({
    example: 'engineering-lead',
    description: 'Name of corporate role',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'Lead Engineer with Maker privileges',
    description: 'Role description',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class SyncGroupTreeItemDto {
  @ApiProperty({
    example: 'Engineering',
    description: 'Name of corporate group/department',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: { departmentCode: ['ENG-01'], costCenter: ['CC-900'] },
    description: 'Custom metadata attributes',
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string[] | string>;

  @ApiPropertyOptional({
    example: ['user', 'maker'],
    description: 'Roles mapped to members of this group',
    isArray: true,
    type: String,
  })
  @IsArray()
  @IsOptional()
  roles?: string[];

  @ApiPropertyOptional({
    description: 'Nested child subgroups',
    type: () => [SyncGroupTreeItemDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SyncGroupTreeItemDto)
  subGroups?: SyncGroupTreeItemDto[];
}

export class SyncIdpHierarchyDto {
  @ApiPropertyOptional({
    description: 'Corporate roles to synchronize/import into the tenant realm',
    type: [SyncRoleItemDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SyncRoleItemDto)
  roles?: SyncRoleItemDto[];

  @ApiPropertyOptional({
    description: 'Hierarchical group/department tree to synchronize/import',
    type: [SyncGroupTreeItemDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SyncGroupTreeItemDto)
  groups?: SyncGroupTreeItemDto[];

  @ApiPropertyOptional({
    example: { clientId: 'xxx', clientSecret: 'yyy', tenantDirectoryId: 'zzz' },
    description:
      'Optional directory API credentials for live Graph/SCIM directory discovery',
  })
  @IsObject()
  @IsOptional()
  providerCredentials?: Record<string, string>;

  @ApiPropertyOptional({
    example: 'MERGE',
    enum: ['MERGE', 'REPLACE'],
    description:
      'Sync behavior: MERGE preserves existing groups/roles; REPLACE overwrites them',
    default: 'MERGE',
  })
  @IsString()
  @IsOptional()
  @IsIn(['MERGE', 'REPLACE'])
  syncMode?: 'MERGE' | 'REPLACE';
}

export class SyncHierarchyResultDto {
  @ApiProperty({
    example: 4,
    description: 'Number of corporate roles created or updated',
  })
  rolesCreated: number;

  @ApiProperty({
    example: 3,
    description: 'Number of top-level corporate groups created',
  })
  groupsCreated: number;

  @ApiProperty({
    example: 5,
    description: 'Number of nested subgroups created',
  })
  subgroupsCreated: number;

  @ApiProperty({
    example: 7,
    description: 'Number of role-to-group mappings assigned',
  })
  roleMappingsCreated: number;

  @ApiProperty({
    example: [
      'Created role: engineering-lead',
      'Created group: Engineering',
      'Created subgroup: DevOps under Engineering',
      'Mapped role maker to group DevOps',
    ],
    description: 'Detailed execution logs of the sync operation',
    isArray: true,
    type: String,
  })
  details: string[];
}
