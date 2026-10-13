export enum DocumentUploadStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  FAILED = 'FAILED',
  DELETED = 'DELETED',
}

/**
 * Backend Integration Contract • RAG Document Ingestion • Schema v1.0
 */
export interface IngestionMetadataV1 {
  schema_version: '1.0';
  tenant_id: string;
  document: {
    document_id: string;
    name: string;
    version: string;
    categories: string[];
  };
  access: {
    departments?: string[];
    allowed_users?: string[];
    excluded_users?: string[];
  };
  metadata?: {
    updated_at?: string;
  };
}

export interface DocumentEntity {
  id: string;
  tenantId: string;
  fileName: string;
  stem: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  metadataS3Key: string;
  status: DocumentUploadStatus;
  metadata: IngestionMetadataV1;
  uploadedBy: string;
  uploadedAt?: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}

export interface DocumentFilter {
  tenantId: string;
  status?: DocumentUploadStatus;
  category?: string;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedDocuments {
  items: DocumentEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DocumentSummaryMetrics {
  totalDocuments: number;
  totalSizeBytes: number;
  statusCounts: Record<DocumentUploadStatus, number>;
  categoryCounts: Record<string, number>;
}

export interface IDocumentRepository {
  create(doc: DocumentEntity): Promise<DocumentEntity>;
  findById(tenantId: string, id: string): Promise<DocumentEntity | null>;
  findByStem(tenantId: string, stem: string): Promise<DocumentEntity | null>;
  update(
    tenantId: string,
    id: string,
    partial: Partial<DocumentEntity>,
  ): Promise<DocumentEntity | null>;
  delete(tenantId: string, id: string): Promise<boolean>;
  findMany(filter: DocumentFilter): Promise<PaginatedDocuments>;
  getSummary(tenantId: string): Promise<DocumentSummaryMetrics>;
}

export const DOCUMENT_REPOSITORY_TOKEN = Symbol('IDocumentRepository');
