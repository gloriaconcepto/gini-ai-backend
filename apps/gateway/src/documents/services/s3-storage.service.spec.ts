import { ConfigService } from '@nestjs/config';
import { S3StorageService } from './s3-storage.service';
import { IngestionMetadataV1 } from '../documents.types';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((args) => ({ ...args, type: 'PutObject' })),
    GetObjectCommand: jest.fn().mockImplementation((args) => ({ ...args, type: 'GetObject' })),
    HeadObjectCommand: jest.fn().mockImplementation((args) => ({ ...args, type: 'HeadObject' })),
    DeleteObjectCommand: jest.fn().mockImplementation((args) => ({ ...args, type: 'DeleteObject' })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.us-west-2.amazonaws.com/test-url'),
}));

describe('S3StorageService', () => {
  let service: S3StorageService;
  let configService: ConfigService;

  const sampleMetadata: IngestionMetadataV1 = {
    schema_version: '1.0',
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
      excluded_users: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_BUCKET_NAME') return 'gini-rag-documents';
        if (key === 'AWS_S3_REGION') return 'us-west-2';
        if (key === 'AWS_S3_PRESIGNED_EXPIRATION_SECONDS') return 900;
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new S3StorageService(configService);
  });

  it('should generate an upload presigned URL', async () => {
    const res = await service.getUploadPresignedUrl(
      'tenant-001',
      'performance-policy.pdf',
      'application/pdf',
    );

    expect(res.s3Key).toBe('tenant-001/performance-policy.pdf');
    expect(res.uploadUrl).toBe('https://s3.us-west-2.amazonaws.com/test-url');
    expect(res.expiresIn).toBe(900);
  });

  it('should generate a download presigned URL', async () => {
    const url = await service.getDownloadPresignedUrl(
      'tenant-001/performance-policy.pdf',
      300,
    );
    expect(url).toBe('https://s3.us-west-2.amazonaws.com/test-url');
  });

  it('should write metadata JSON to S3', async () => {
    mockSend.mockResolvedValueOnce({});
    await service.writeMetadataJson('tenant-001/performance-policy.metadata.json', sampleMetadata);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('should verify object exists on S3', async () => {
    mockSend.mockResolvedValueOnce({
      ContentLength: 1024,
      ETag: '"etag-123"',
      ContentType: 'application/pdf',
    });

    const res = await service.verifyObjectExists('tenant-001/performance-policy.pdf');
    expect(res.exists).toBe(true);
    expect(res.size).toBe(1024);
    expect(res.etag).toBe('"etag-123"');
  });

  it('should return exists: false when object not found on S3', async () => {
    const notFoundError = new Error('Not Found');
    notFoundError.name = 'NotFound';
    mockSend.mockRejectedValueOnce(notFoundError);

    const res = await service.verifyObjectExists('tenant-001/missing.pdf');
    expect(res.exists).toBe(false);
  });

  it('should rethrow unexpected errors during verification', async () => {
    const networkError = new Error('AWS Network error');
    mockSend.mockRejectedValueOnce(networkError);

    await expect(service.verifyObjectExists('tenant-001/file.pdf')).rejects.toThrow(
      'AWS Network error',
    );
  });

  it('should delete file pair from S3', async () => {
    mockSend.mockResolvedValue({});
    await service.deleteFilePair('tenant-001/file.pdf', 'tenant-001/file.metadata.json');
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it('should upload direct buffer to S3', async () => {
    mockSend.mockResolvedValueOnce({ ETag: '"direct-etag"' });
    const res = await service.uploadDirect(
      'tenant-001/direct.pdf',
      Buffer.from('test-content'),
      'application/pdf',
    );
    expect(res.size).toBe(12);
    expect(res.etag).toBe('"direct-etag"');
  });
});
