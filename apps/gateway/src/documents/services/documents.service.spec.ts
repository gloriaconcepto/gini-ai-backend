import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import {
  DOCUMENT_REPOSITORY_TOKEN,
  DocumentUploadStatus,
  IDocumentRepository,
} from '../documents.types';
import {
  IStorageService,
  STORAGE_SERVICE_TOKEN,
} from '../interfaces/storage-service.interface';
import { InMemoryDocumentRepository } from '../adapters/in-memory-document.repository';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let repository: InMemoryDocumentRepository;
  let storage: jest.Mocked<IStorageService>;

  beforeEach(async () => {
    storage = {
      getUploadPresignedUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.test/upload',
        s3Key: 'tenant-001/performance-policy.pdf',
        expiresIn: 900,
      }),
      getDownloadPresignedUrl: jest
        .fn()
        .mockResolvedValue('https://s3.test/download'),
      writeMetadataJson: jest.fn().mockResolvedValue(undefined),
      verifyObjectExists: jest.fn().mockResolvedValue({
        exists: true,
        size: 2048,
        etag: '"etag-123"',
      }),
      deleteFilePair: jest.fn().mockResolvedValue(undefined),
      uploadDirect: jest.fn().mockResolvedValue({
        size: 1024,
        etag: '"direct-etag"',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: DOCUMENT_REPOSITORY_TOKEN,
          useClass: InMemoryDocumentRepository,
        },
        {
          provide: STORAGE_SERVICE_TOKEN,
          useValue: storage,
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    repository = module.get<InMemoryDocumentRepository>(
      DOCUMENT_REPOSITORY_TOKEN,
    );
  });

  afterEach(() => {
    repository.clear();
    jest.clearAllMocks();
  });

  describe('initiateUpload', () => {
    it('should initialize document in PENDING_UPLOAD status and return presigned URL', async () => {
      const res = await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'performance-policy.pdf',
        name: 'Performance Policy',
        version: '1.0',
        categories: ['security-risk', 'technology-architecture'],
        departments: ['technology'],
        excludedUsers: ['user-alex-rivera'],
      });

      expect(res.documentId).toBeDefined();
      expect(res.fileName).toBe('performance-policy.pdf');
      expect(res.stem).toBe('performance-policy');
      expect(res.uploadUrl).toBe('https://s3.test/upload');
      expect(res.s3Key).toBe('tenant-001/performance-policy.pdf');
      expect(res.metadataS3Key).toBe('tenant-001/performance-policy.metadata.json');
      expect(res.status).toBe(DocumentUploadStatus.PENDING_UPLOAD);

      const saved = await repository.findById('tenant-001', res.documentId);
      expect(saved).toBeDefined();
      expect(saved?.metadata.schema_version).toBe('1.0');
      expect(saved?.metadata.document.document_id).toBe('performance-policy');
      expect(saved?.metadata.access.departments).toEqual(['technology']);
      expect(saved?.metadata.access.excluded_users).toEqual(['user-alex-rivera']);
    });
  });

  describe('completeUpload', () => {
    it('should verify S3 file, write metadata JSON pair, and mark as UPLOADED', async () => {
      const initiated = await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'performance-policy.pdf',
      });

      const completed = await service.completeUpload(
        'tenant-001',
        initiated.documentId,
      );

      expect(completed.status).toBe(DocumentUploadStatus.UPLOADED);
      expect(completed.fileSize).toBe(2048);
      expect(completed.uploadedAt).toBeDefined();
      expect(storage.verifyObjectExists).toHaveBeenCalledWith(
        'tenant-001/performance-policy.pdf',
      );
      expect(storage.writeMetadataJson).toHaveBeenCalledWith(
        'tenant-001/performance-policy.metadata.json',
        expect.objectContaining({
          schema_version: '1.0',
          tenant_id: 'tenant-001',
        }),
      );
    });

    it('should throw NotFoundException if document does not exist', async () => {
      await expect(
        service.completeUpload('tenant-001', 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should transition to FAILED and throw BadRequestException if file is missing on S3', async () => {
      storage.verifyObjectExists.mockResolvedValueOnce({ exists: false });

      const initiated = await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'missing-doc.pdf',
      });

      await expect(
        service.completeUpload('tenant-001', initiated.documentId),
      ).rejects.toThrow(BadRequestException);

      const saved = await repository.findById('tenant-001', initiated.documentId);
      expect(saved?.status).toBe(DocumentUploadStatus.FAILED);
      expect(saved?.errorMessage).toContain('does not exist on S3');
    });
  });

  describe('uploadDirect', () => {
    it('should directly upload file and metadata JSON to S3', async () => {
      const mockFile = {
        originalname: 'direct-upload.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('pdf-content'),
      } as Express.Multer.File;

      const res = await service.uploadDirect('tenant-001', 'user-1', mockFile, {
        fileName: 'direct-upload.pdf',
        name: 'Direct Document',
      });

      expect(res.status).toBe(DocumentUploadStatus.UPLOADED);
      expect(res.stem).toBe('direct-upload');
      expect(storage.uploadDirect).toHaveBeenCalledWith(
        'tenant-001/direct-upload.pdf',
        mockFile.buffer,
        'application/pdf',
      );
      expect(storage.writeMetadataJson).toHaveBeenCalledWith(
        'tenant-001/direct-upload.metadata.json',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException if file is undefined', async () => {
      await expect(
        service.uploadDirect(
          'tenant-001',
          'user-1',
          undefined as any,
          {} as any,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAccess', () => {
    it('should update authorization metadata without touching source file', async () => {
      const initiated = await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'policy.pdf',
        departments: ['engineering'],
      });

      const updated = await service.updateAccess(
        'tenant-001',
        initiated.documentId,
        {
          departments: ['engineering', 'compliance'],
          allowedUsers: ['user-bob'],
          excludedUsers: ['user-charlie'],
          categories: ['governance'],
        },
      );

      expect(updated.metadata.access.departments).toEqual([
        'engineering',
        'compliance',
      ]);
      expect(updated.metadata.access.allowed_users).toEqual(['user-bob']);
      expect(updated.metadata.access.excluded_users).toEqual(['user-charlie']);
      expect(updated.metadata.document.categories).toEqual(['governance']);
      expect(storage.writeMetadataJson).toHaveBeenCalledWith(
        'tenant-001/policy.metadata.json',
        expect.objectContaining({
          access: {
            departments: ['engineering', 'compliance'],
            allowed_users: ['user-bob'],
            excluded_users: ['user-charlie'],
          },
        }),
      );
    });

    it('should throw NotFoundException when updating non-existent document', async () => {
      await expect(
        service.updateAccess('tenant-001', 'non-existent', {
          departments: ['legal'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDocument, listDocuments & getSummary', () => {
    it('should get a document by ID or throw NotFoundException', async () => {
      const initiated = await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'test.pdf',
      });

      const doc = await service.getDocument('tenant-001', initiated.documentId);
      expect(doc.id).toBe(initiated.documentId);

      await expect(
        service.getDocument('tenant-001', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should list paginated documents and return summary', async () => {
      await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'doc1.pdf',
      });
      await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'doc2.pdf',
      });

      const list = await service.listDocuments({
        tenantId: 'tenant-001',
        page: 1,
        limit: 10,
      });
      expect(list.total).toBe(2);
      expect(list.items.length).toBe(2);

      const summary = await service.getSummary('tenant-001');
      expect(summary.totalDocuments).toBe(2);
      expect(
        summary.statusCounts[DocumentUploadStatus.PENDING_UPLOAD],
      ).toBe(2);
    });
  });

  describe('getDownloadUrl & deleteDocument', () => {
    it('should return download presigned URL only for UPLOADED documents', async () => {
      const initiated = await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'downloadable.pdf',
      });

      // Pending upload should fail download
      await expect(
        service.getDownloadUrl('tenant-001', initiated.documentId),
      ).rejects.toThrow(BadRequestException);

      // Complete upload
      await service.completeUpload('tenant-001', initiated.documentId);

      const download = await service.getDownloadUrl(
        'tenant-001',
        initiated.documentId,
      );
      expect(download.downloadUrl).toBe('https://s3.test/download');
      expect(storage.getDownloadPresignedUrl).toHaveBeenCalledWith(
        'tenant-001/downloadable.pdf',
      );
    });

    it('should throw NotFoundException when getting download url for unknown doc', async () => {
      await expect(
        service.getDownloadUrl('tenant-001', 'unknown-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete file pair and remove document record', async () => {
      const initiated = await service.initiateUpload('tenant-001', 'user-1', {
        fileName: 'to-delete.pdf',
      });

      const deleteRes = await service.deleteDocument(
        'tenant-001',
        initiated.documentId,
      );
      expect(deleteRes.success).toBe(true);
      expect(storage.deleteFilePair).toHaveBeenCalledWith(
        'tenant-001/to-delete.pdf',
        'tenant-001/to-delete.metadata.json',
      );

      await expect(
        service.getDocument('tenant-001', initiated.documentId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when deleting unknown doc', async () => {
      await expect(
        service.deleteDocument('tenant-001', 'unknown-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
