import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsArray,
} from 'class-validator';

export class CreateIamGroupDto {
  @ApiProperty({
    example: 'Engineering',
    description: 'Name of the corporate group / department',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: { departmentCode: ['ENG-01'], costCenter: ['CC-1042'] },
    description: 'Custom metadata attributes associated with the group',
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string[] | string>;

  @ApiPropertyOptional({
    example: ['user'],
    description: 'Optional initial realm roles to bind to this group',
    isArray: true,
    type: String,
  })
  @IsArray()
  @IsOptional()
  roles?: string[];
}

export class CreateIamSubgroupDto {
  @ApiProperty({
    example: 'DevOps',
    description: 'Name of the subgroup under the parent department',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: { teamLead: ['lead@example.com'] },
    description: 'Custom metadata attributes for the subgroup',
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string[] | string>;
}

export class UpdateIamGroupDto {
  @ApiPropertyOptional({
    example: 'Core Platform Engineering',
    description: 'Updated name of the group',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: { departmentCode: ['ENG-02'], costCenter: ['CC-1045'] },
    description: 'Updated attributes for the group',
  })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, string[] | string>;
}

export class AssignGroupRoleDto {
  @ApiProperty({
    example: 'maker',
    description: 'Name of the realm role to assign to the group',
  })
  @IsString()
  @IsNotEmpty()
  roleName: string;
}

export class IamGroupResponseDto {
  @ApiPropertyOptional({
    example: '9c53c072-4ea5-4122-8e1c-5d181057e034',
    description: 'Unique Keycloak group identifier',
  })
  id?: string;

  @ApiPropertyOptional({
    example: 'Engineering',
    description: 'Group name',
  })
  name?: string;

  @ApiPropertyOptional({
    example: '/Engineering',
    description: 'Hierarchical path of the group',
  })
  path?: string;

  @ApiPropertyOptional({
    example: { departmentCode: ['ENG-01'] },
    description: 'Custom attributes and corporate metadata',
  })
  attributes?: Record<string, string[]>;

  @ApiPropertyOptional({
    example: ['maker', 'user'],
    description: 'Realm roles mapped directly to this group',
    isArray: true,
    type: String,
  })
  realmRoles?: string[];

  @ApiPropertyOptional({
    description: 'Subgroups nested within this group',
    type: () => [IamGroupResponseDto],
  })
  subGroups?: IamGroupResponseDto[];
}
