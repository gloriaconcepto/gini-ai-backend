import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from '../services/documents.service';
import { DocumentUploadStatus } from '../documents.types';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: jest.Mocked<DocumentsService>;

  const mockDocumentResponse = {
    id: 'doc-123',
    tenantId: 'tenant-001',
    fileName: 'performance-policy.pdf',
    stem: 'performance-policy',
    extension: '.pdf',
    mimeType: 'application/pdf',
    fileSize: 1048576,
    s3Key: 'tenant-001/performance-policy.pdf',
    metadataS3Key: 'tenant-001/performance-policy.metadata.json',
    status: DocumentUploadStatus.UPLOADED,
    metadata: {
      schema_version: '1.0' as const,
      tenant_id: 'tenant-001',
      document: {
        document_id: 'performance-policy',
        name: 'Performance Policy',
        version: '1.0',
        categories: ['security-risk'],
      },
      access: {
        departments: ['technology'],
        allowed_users: [],
        excluded_users: ['user-alex-rivera'],
      },
    },
    uploadedBy: 'user-admin',
    createdAt: '2026-10-13T16:00:00Z',
    updatedAt: '2026-10-13T16:00:00Z',
  };

  beforeEach(async () => {
    service = {
      initiateUpload: jest.fn().mockResolvedValue({
        documentId: 'doc-123',
        fileName: 'performance-policy.pdf',
        stem: 'performance-policy',
        uploadUrl: 'https://s3.test/upload',
        s3Key: 'tenant-001/performance-policy.pdf',
        metadataS3Key: 'tenant-001/performance-policy.metadata.json',
        expiresIn: 900,
        status: DocumentUploadStatus.PENDING_UPLOAD,
      }),
      completeUpload: jest.fn().mockResolvedValue(mockDocumentResponse),
      uploadDirect: jest.fn().mockResolvedValue(mockDocumentResponse),
      updateAccess: jest.fn().mockResolvedValue(mockDocumentResponse),
      getDocument: jest.fn().mockResolvedValue(mockDocumentResponse),
      listDocuments: jest.fn().mockResolvedValue({
        items: [mockDocumentResponse],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      getSummary: jest.fn().mockResolvedValue({
        totalDocuments: 1,
        totalSizeBytes: 1048576,
        statusCounts: {
          [DocumentUploadStatus.PENDING_UPLOAD]: 0,
          [DocumentUploadStatus.UPLOADING]: 0,
          [DocumentUploadStatus.UPLOADED]: 1,
          [DocumentUploadStatus.FAILED]: 0,
          [DocumentUploadStatus.DELETED]: 0,
        },
        categoryCounts: { 'security-risk': 1 },
      }),
      getDownloadUrl: jest.fn().mockResolvedValue({
        downloadUrl: 'https://s3.test/download',
        expiresIn: 300,
      }),
      deleteDocument: jest.fn().mockResolvedValue({
        success: true,
        message: 'Deleted successfully',
      }),
    } as unknown as jest.Mocked<DocumentsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  const mockReqWithJwt = {
    user: {
      tenantId: 'tenant-001',
      userId: 'user-admin',
    },
    headers: {},
  };

  const mockReqWithHeader = {
    headers: {
      'x-tenant-id': 'tenant-header',
    },
  };

  it('should generate upload URL with tenant from JWT', async () => {
    const res = await controller.generateUploadUrl(mockReqWithJwt, {
      fileName: 'performance-policy.pdf',
    });

    expect(res.documentId).toBe('doc-123');
    expect(service.initiateUpload).toHaveBeenCalledWith(
      'tenant-001',
      'user-admin',
      expect.objectContaining({ fileName: 'performance-policy.pdf' }),
    );
  });

  it('should extract tenant from X-Tenant-ID header when JWT is absent', async () => {
    await controller.generateUploadUrl(mockReqWithHeader, {
      fileName: 'test.pdf',
    });

    expect(service.initiateUpload).toHaveBeenCalledWith(
      'tenant-header',
      'system-user',
      expect.any(Object),
    );
  });

  it('should handle direct multipart upload', async () => {
    const mockFile = {
      originalname: 'upload.pdf',
      mimetype: 'application/pdf',
      size: 500,
      buffer: Buffer.from('data'),
    } as Express.Multer.File;

    const res = await controller.directUpload(mockReqWithJwt, mockFile, {
      name: 'Direct Policy',
      categories: ['tech'],
    });

    expect(res.id).toBe('doc-123');
    expect(service.uploadDirect).toHaveBeenCalledWith(
      'tenant-001',
      'user-admin',
      mockFile,
      expect.objectContaining({
        fileName: 'upload.pdf',
        categories: ['tech'],
      }),
    );
  });

  it('should complete upload', async () => {
    const res = await controller.completeUpload(mockReqWithJwt, 'doc-123');
    expect(res.status).toBe(DocumentUploadStatus.UPLOADED);
    expect(service.completeUpload).toHaveBeenCalledWith(
      'tenant-001',
      'doc-123',
    );
  });

  it('should update access control', async () => {
    const res = await controller.updateAccess(mockReqWithJwt, 'doc-123', {
      departments: ['finance'],
    });

    expect(res.id).toBe('doc-123');
    expect(service.updateAccess).toHaveBeenCalledWith(
      'tenant-001',
      'doc-123',
      { departments: ['finance'] },
    );
  });

  it('should get summary statistics', async () => {
    const summary = await controller.getSummary(mockReqWithJwt);
    expect(summary.totalDocuments).toBe(1);
    expect(service.getSummary).toHaveBeenCalledWith('tenant-001');
  });

  it('should get document by ID', async () => {
    const res = await controller.getDocument(mockReqWithJwt, 'doc-123');
    expect(res.id).toBe('doc-123');
    expect(service.getDocument).toHaveBeenCalledWith('tenant-001', 'doc-123');
  });

  it('should get download URL', async () => {
    const res = await controller.getDownloadUrl(mockReqWithJwt, 'doc-123');
    expect(res.downloadUrl).toBe('https://s3.test/download');
    expect(service.getDownloadUrl).toHaveBeenCalledWith(
      'tenant-001',
      'doc-123',
    );
  });

  it('should list documents with query filters', async () => {
    const list = await controller.listDocuments(
      mockReqWithJwt,
      DocumentUploadStatus.UPLOADED,
      'security-risk',
      'technology',
      'policy',
      '1',
      '10',
    );

    expect(list.items.length).toBe(1);
    expect(service.listDocuments).toHaveBeenCalledWith({
      tenantId: 'tenant-001',
      status: DocumentUploadStatus.UPLOADED,
      category: 'security-risk',
      department: 'technology',
      search: 'policy',
      page: 1,
      limit: 10,
    });
  });

  it('should delete document', async () => {
    const res = await controller.deleteDocument(mockReqWithJwt, 'doc-123');
    expect(res.success).toBe(true);
    expect(service.deleteDocument).toHaveBeenCalledWith(
      'tenant-001',
      'doc-123',
    );
  });
});
