import { ConfigService } from '@nestjs/config';
import { MockStorageService } from './mock-storage.service';
import { IngestionMetadataV1 } from '../documents.types';

describe('MockStorageService', () => {
  let service: MockStorageService;
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
      excluded_users: ['user-alex-rivera'],
    },
    metadata: {
      updated_at: '2026-10-08T09:30:00Z',
    },
  };

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_S3_BUCKET_NAME') return 'gini-rag-documents';
        if (key === 'AWS_S3_REGION') return 'us-west-2';
        if (key === 'AWS_S3_PRESIGNED_EXPIRATION_SECONDS') return 900;
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new MockStorageService(configService);
  });

  it('should generate a mock presigned upload URL and stage object', async () => {
    const res = await service.getUploadPresignedUrl(
      'tenant-001',
      'performance-policy.pdf',
      'application/pdf',
    );

    expect(res.s3Key).toBe('tenant-001/performance-policy.pdf');
    expect(res.uploadUrl).toContain('gini-rag-documents.s3.us-west-2.amazonaws.com');
    expect(res.expiresIn).toBe(900);

    const verified = await service.verifyObjectExists(res.s3Key);
    expect(verified.exists).toBe(true);
  });

  it('should generate a mock presigned download URL', async () => {
    const url = await service.getDownloadPresignedUrl(
      'tenant-001/performance-policy.pdf',
      300,
    );
    expect(url).toContain('mock-download=true');
    expect(url).toContain('X-Amz-Expires=300');
  });

  it('should write and retrieve metadata JSON', async () => {
    const s3Key = 'tenant-001/performance-policy.metadata.json';
    await service.writeMetadataJson(s3Key, sampleMetadata);

    const stored = service.getStoredMetadata(s3Key);
    expect(stored).toEqual(sampleMetadata);

    const verified = await service.verifyObjectExists(s3Key);
    expect(verified.exists).toBe(true);
    expect(verified.contentType).toBe('application/json');
  });

  it('should handle direct upload and deletion of file pair', async () => {
    const sourceKey = 'tenant-001/test.txt';
    const metaKey = 'tenant-001/test.metadata.json';

    const directRes = await service.uploadDirect(
      sourceKey,
      Buffer.from('hello world'),
      'text/plain',
    );
    expect(directRes.size).toBe(11);

    await service.writeMetadataJson(metaKey, sampleMetadata);

    expect((await service.verifyObjectExists(sourceKey)).exists).toBe(true);
    expect((await service.verifyObjectExists(metaKey)).exists).toBe(true);

    await service.deleteFilePair(sourceKey, metaKey);

    expect((await service.verifyObjectExists(sourceKey)).exists).toBe(false);
    expect((await service.verifyObjectExists(metaKey)).exists).toBe(false);
  });

  it('should return exists: false for un-staged objects', async () => {
    const verified = await service.verifyObjectExists('non-existent-key');
    expect(verified.exists).toBe(false);
  });
});
