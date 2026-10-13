import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';

export class GenerateTextDto {
  @ApiProperty({
    description: 'Input prompt or instructions for the LLM.',
    example: 'Summarize the compliance guidelines for data retention.',
  })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of tokens to generate.',
    example: 1024,
    default: 1024,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(8192)
  maxTokens?: number;

  @ApiPropertyOptional({
    description: 'Sampling temperature for generation (0.0 = deterministic, 1.0 = creative).',
    example: 0.7,
    default: 0.7,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Top-p nucleus sampling probability threshold.',
    example: 0.9,
    default: 0.9,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;
}

export class GenerateEmbeddingDto {
  @ApiProperty({
    description: 'Text string to generate embedding vector for.',
    example: 'Enterprise risk management frameworks and dual control requirements.',
  })
  @IsString()
  @IsNotEmpty()
  text!: string;
}

export class RagQueryDto {
  @ApiProperty({
    description: 'User natural language query to retrieve context and generate an answer for.',
    example: 'What are the required approvals for adding a new identity provider?',
  })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiPropertyOptional({
    description: 'Number of relevant knowledge chunks to retrieve from OpenSearch.',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  topK?: number;

  @ApiPropertyOptional({
    description: 'Whether to use Hybrid Search (k-NN vector + BM25 keyword) instead of vector-only search.',
    example: true,
    default: true,
  })
  @IsOptional()
  useHybridSearch?: boolean;
}

export class IndexChunkDto {
  @ApiProperty({
    description: 'Unique identifier for the text chunk.',
    example: 'chunk-12345',
  })
  @IsString()
  @IsNotEmpty()
  chunkId!: string;

  @ApiProperty({
    description: 'Parent document identifier.',
    example: 'doc-67890',
  })
  @IsString()
  @IsNotEmpty()
  documentId!: string;

  @ApiProperty({
    description: 'Raw text content of the chunk.',
    example: 'Maker-Checker policy requires all mutation requests to be approved by a distinct Checker.',
  })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiPropertyOptional({
    description: 'Optional metadata key-value pairs (e.g. page number, filename).',
    example: { page: 3, source: 'governance-policy.pdf' },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
