import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class InitiateUploadDto {
  @ApiProperty({
    description: 'Original file name including extension (e.g. performance-policy.pdf)',
    example: 'performance-policy.pdf',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_\-\. ]+$/, {
    message: 'File name contains invalid characters',
  })
  fileName!: string;

  @ApiPropertyOptional({
    description: 'Human-readable title or display name for the document',
    example: 'Performance Policy',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Source document version string',
    example: '1.0',
    default: '1.0',
  })
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional({
    description: 'Document classification categories (informative, not authorization rules)',
    example: ['security-risk', 'technology-architecture'],
    type: [String],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Departments permitted to access the document in RAG queries',
    example: ['technology', 'compliance'],
    type: [String],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departments?: string[];

  @ApiPropertyOptional({
    description: 'Specific user IDs explicitly permitted to access the document',
    example: ['user-alice-123'],
    type: [String],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedUsers?: string[];

  @ApiPropertyOptional({
    description: 'Specific user IDs explicitly denied access (takes precedence over department access)',
    example: ['user-alex-rivera', 'user-zainab-bello'],
    type: [String],
    default: [],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludedUsers?: string[];

  @ApiPropertyOptional({
    description: 'Declared file size in bytes',
    example: 1048576,
  })
  @IsNumber()
  @IsOptional()
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'MIME type of the document',
    example: 'application/pdf',
    default: 'application/octet-stream',
  })
  @IsString()
  @IsOptional()
  mimeType?: string;
}
