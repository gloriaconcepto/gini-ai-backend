import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateDocumentAccessDto {
  @ApiPropertyOptional({
    description: 'Departments permitted to access the document in RAG queries',
    example: ['technology', 'legal'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departments?: string[];

  @ApiPropertyOptional({
    description: 'Specific user IDs explicitly permitted to access the document',
    example: ['user-alice-123'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedUsers?: string[];

  @ApiPropertyOptional({
    description: 'Specific user IDs explicitly denied access (takes precedence over department access)',
    example: ['user-alex-rivera'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludedUsers?: string[];

  @ApiPropertyOptional({
    description: 'Updated categories for document classification',
    example: ['security-risk', 'policy-compliance'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];
}
