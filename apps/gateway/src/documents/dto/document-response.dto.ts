import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentUploadStatus } from '../documents.types';

export class DocumentMetadataDocumentDto {
  @ApiProperty({ example: 'performance-policy' })
  document_id!: string;

  @ApiProperty({ example: 'Performance Policy' })
  name!: string;

  @ApiProperty({ example: '1.0' })
  version!: string;

  @ApiProperty({
    example: ['security-risk', 'technology-architecture'],
    type: [String],
  })
  categories!: string[];
}

export class DocumentMetadataAccessDto {
  @ApiPropertyOptional({ example: ['technology'], type: [String] })
  departments?: string[];

  @ApiPropertyOptional({ example: [], type: [String] })
  allowed_users?: string[];

  @ApiPropertyOptional({
    example: ['user-alex-rivera', 'user-zainab-bello'],
    type: [String],
  })
  excluded_users?: string[];
}

export class DocumentMetadataDetailsDto {
  @ApiPropertyOptional({ example: '2026-10-08T09:30:00Z' })
  updated_at?: string;
}

export class IngestionMetadataV1Dto {
  @ApiProperty({ example: '1.0' })
  schema_version!: string;

  @ApiProperty({ example: 'tenant-001' })
  tenant_id!: string;

  @ApiProperty({ type: DocumentMetadataDocumentDto })
  document!: DocumentMetadataDocumentDto;

  @ApiProperty({ type: DocumentMetadataAccessDto })
  access!: DocumentMetadataAccessDto;

  @ApiPropertyOptional({ type: DocumentMetadataDetailsDto })
  metadata?: DocumentMetadataDetailsDto;
}

export class DocumentResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id!: string;

  @ApiProperty({ example: 'tenant-001' })
  tenantId!: string;

  @ApiProperty({ example: 'performance-policy.pdf' })
  fileName!: string;

  @ApiProperty({ example: 'performance-policy' })
  stem!: string;

  @ApiProperty({ example: '.pdf' })
  extension!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 1048576 })
  fileSize!: number;

  @ApiProperty({ example: 'tenant-001/performance-policy.pdf' })
  s3Key!: string;

  @ApiProperty({ example: 'tenant-001/performance-policy.metadata.json' })
  metadataS3Key!: string;

  @ApiProperty({
    enum: DocumentUploadStatus,
    example: DocumentUploadStatus.UPLOADED,
  })
  status!: DocumentUploadStatus;

  @ApiProperty({ type: IngestionMetadataV1Dto })
  metadata!: IngestionMetadataV1Dto;

  @ApiProperty({ example: 'user-admin-123' })
  uploadedBy!: string;

  @ApiPropertyOptional({ example: '2026-10-13T16:00:00Z' })
  uploadedAt?: string;

  @ApiProperty({ example: '2026-10-13T15:55:00Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-13T16:00:00Z' })
  updatedAt!: string;

  @ApiPropertyOptional({ example: 'File verification failed on S3' })
  errorMessage?: string;
}

export class UploadUrlResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  documentId!: string;

  @ApiProperty({ example: 'performance-policy.pdf' })
  fileName!: string;

  @ApiProperty({ example: 'performance-policy' })
  stem!: string;

  @ApiProperty({
    example:
      'https://gini-rag-documents.s3.us-west-2.amazonaws.com/tenant-001/performance-policy.pdf?...',
  })
  uploadUrl!: string;

  @ApiProperty({ example: 'tenant-001/performance-policy.pdf' })
  s3Key!: string;

  @ApiProperty({ example: 'tenant-001/performance-policy.metadata.json' })
  metadataS3Key!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;

  @ApiProperty({
    enum: DocumentUploadStatus,
    example: DocumentUploadStatus.PENDING_UPLOAD,
  })
  status!: DocumentUploadStatus;
}

export class DocumentListResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  items!: DocumentResponseDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class DocumentSummaryResponseDto {
  @ApiProperty({ example: 10 })
  totalDocuments!: number;

  @ApiProperty({ example: 52428800 })
  totalSizeBytes!: number;

  @ApiProperty({
    example: {
      PENDING_UPLOAD: 2,
      UPLOADING: 1,
      UPLOADED: 7,
      FAILED: 0,
      DELETED: 0,
    },
  })
  statusCounts!: Record<string, number>;

  @ApiProperty({
    example: {
      'security-risk': 5,
      'technology-architecture': 3,
    },
  })
  categoryCounts!: Record<string, number>;
}

export class DownloadUrlResponseDto {
  @ApiProperty({
    example:
      'https://gini-rag-documents.s3.us-west-2.amazonaws.com/tenant-001/performance-policy.pdf?...',
  })
  downloadUrl!: string;

  @ApiProperty({ example: 300 })
  expiresIn!: number;
}
