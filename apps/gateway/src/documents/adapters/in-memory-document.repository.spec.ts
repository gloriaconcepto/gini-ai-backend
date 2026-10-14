import { InMemoryDocumentRepository } from './in-memory-document.repository';
import {
  DocumentEntity,
  DocumentUploadStatus,
  IngestionMetadataV1,
} from '../documents.types';

describe('InMemoryDocumentRepository', () => {
  let repository: InMemoryDocumentRepository;

  const mockMetadata: IngestionMetadataV1 = {
    schema_version: '1.0',
    tenant_id: 'tenant-001',
    document: {
      document_id: 'performance-policy',
      name: 'Performance Policy',
      version: '1.0',
      categories: ['security-risk', 'technology-architecture'],
    },
    access: {
      departments: ['technology'],
      allowed_users: [],
      excluded_users: ['user-alex-rivera'],
    },
    metadata: {
      updated_at: '2026-10-08T09:30:00Z',
    },
  };

  const sampleDoc: DocumentEntity = {
    id: 'doc-123',
    tenantId: 'tenant-001',
    fileName: 'performance-policy.pdf',
    stem: 'performance-policy',
    extension: '.pdf',
    mimeType: 'application/pdf',
    fileSize: 1048576,
    s3Key: 'tenant-001/performance-policy.pdf',
    metadataS3Key: 'tenant-001/performance-policy.metadata.json',
    status: DocumentUploadStatus.PENDING_UPLOAD,
    metadata: mockMetadata,
    uploadedBy: 'user-admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    repository = new InMemoryDocumentRepository();
  });

  it('should create and retrieve a document by id and tenant', async () => {
    await repository.create(sampleDoc);

    const retrieved = await repository.findById('tenant-001', 'doc-123');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('doc-123');
    expect(retrieved?.stem).toBe('performance-policy');
  });

  it('should return null when retrieving by wrong tenant', async () => {
    await repository.create(sampleDoc);

    const retrieved = await repository.findById('tenant-other', 'doc-123');
    expect(retrieved).toBeNull();
  });

  it('should find document by stem and tenant', async () => {
    await repository.create(sampleDoc);

    const retrieved = await repository.findByStem(
      'tenant-001',
      'performance-policy',
    );
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('doc-123');

    const notFound = await repository.findByStem(
      'tenant-001',
      'non-existent-stem',
    );
    expect(notFound).toBeNull();
  });

  it('should update document fields', async () => {
    await repository.create(sampleDoc);

    const updated = await repository.update('tenant-001', 'doc-123', {
      status: DocumentUploadStatus.UPLOADED,
      fileSize: 2048,
    });

    expect(updated).toBeDefined();
    expect(updated?.status).toBe(DocumentUploadStatus.UPLOADED);
    expect(updated?.fileSize).toBe(2048);

    const retrieved = await repository.findById('tenant-001', 'doc-123');
    expect(retrieved?.status).toBe(DocumentUploadStatus.UPLOADED);
  });

  it('should return null when updating non-existent document', async () => {
    const updated = await repository.update('tenant-001', 'doc-none', {
      status: DocumentUploadStatus.FAILED,
    });
    expect(updated).toBeNull();
  });

  it('should soft delete document and omit from queries', async () => {
    await repository.create(sampleDoc);

    const deleted = await repository.delete('tenant-001', 'doc-123');
    expect(deleted).toBe(true);

    const retrieved = await repository.findById('tenant-001', 'doc-123');
    expect(retrieved).toBeNull();

    const notDeleted = await repository.delete('tenant-001', 'doc-unknown');
    expect(notDeleted).toBe(false);
  });

  it('should filter documents by status, category, department, and search query', async () => {
    await repository.create(sampleDoc);
    await repository.create({
      ...sampleDoc,
      id: 'doc-456',
      fileName: 'hr-guidelines.docx',
      stem: 'hr-guidelines',
      metadata: {
        ...mockMetadata,
        document: {
          ...mockMetadata.document,
          document_id: 'hr-guidelines',
          name: 'HR Guidelines',
          categories: ['hr', 'policy'],
        },
        access: {
          departments: ['people-ops'],
        },
      },
      status: DocumentUploadStatus.UPLOADED,
    });

    // Filter by status
    const uploadedOnly = await repository.findMany({
      tenantId: 'tenant-001',
      status: DocumentUploadStatus.UPLOADED,
    });
    expect(uploadedOnly.total).toBe(1);
    expect(uploadedOnly.items[0].id).toBe('doc-456');

    // Filter by category
    const catFiltered = await repository.findMany({
      tenantId: 'tenant-001',
      category: 'security-risk',
    });
    expect(catFiltered.total).toBe(1);
    expect(catFiltered.items[0].id).toBe('doc-123');

    // Filter by department
    const deptFiltered = await repository.findMany({
      tenantId: 'tenant-001',
      department: 'technology',
    });
    expect(deptFiltered.total).toBe(1);
    expect(deptFiltered.items[0].id).toBe('doc-123');

    // Filter by search
    const searchByName = await repository.findMany({
      tenantId: 'tenant-001',
      search: 'guidelines',
    });
    expect(searchByName.total).toBe(1);
    expect(searchByName.items[0].id).toBe('doc-456');

    // Pagination
    const paginated = await repository.findMany({
      tenantId: 'tenant-001',
      page: 1,
      limit: 1,
    });
    expect(paginated.items.length).toBe(1);
    expect(paginated.total).toBe(2);
    expect(paginated.totalPages).toBe(2);
  });

  it('should calculate accurate summary metrics for a tenant', async () => {
    await repository.create(sampleDoc);
    await repository.create({
      ...sampleDoc,
      id: 'doc-789',
      status: DocumentUploadStatus.UPLOADED,
      fileSize: 5000,
    });

    const summary = await repository.getSummary('tenant-001');
    expect(summary.totalDocuments).toBe(2);
    expect(summary.totalSizeBytes).toBe(5000);
    expect(summary.statusCounts[DocumentUploadStatus.PENDING_UPLOAD]).toBe(1);
    expect(summary.statusCounts[DocumentUploadStatus.UPLOADED]).toBe(1);
    expect(summary.categoryCounts['security-risk']).toBe(2);

    repository.clear();
    const clearedSummary = await repository.getSummary('tenant-001');
    expect(clearedSummary.totalDocuments).toBe(0);
  });
});
