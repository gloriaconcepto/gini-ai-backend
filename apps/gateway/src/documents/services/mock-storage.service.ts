import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DirectUploadResult,
  IStorageService,
  ObjectVerificationResult,
  PresignedUploadResult,
} from '../interfaces/storage-service.interface';
import { IngestionMetadataV1 } from '../documents.types';

@Injectable()
export class MockStorageService implements IStorageService {
  private readonly logger = new Logger(MockStorageService.name);
  private readonly objects: Map<string, { buffer?: Buffer; contentType?: string; size: number }> =
    new Map();
  private readonly metadataStore: Map<string, IngestionMetadataV1> = new Map();

  private readonly bucketName: string;
  private readonly region: string;
  private readonly defaultExpiration: number;

  constructor(private readonly config: ConfigService) {
    this.bucketName =
      this.config.get<string>('AWS_S3_BUCKET_NAME') || 'gini-rag-documents';
    this.region = this.config.get<string>('AWS_S3_REGION') || 'us-west-2';
    this.defaultExpiration = Number(
      this.config.get<number>('AWS_S3_PRESIGNED_EXPIRATION_SECONDS') || 900,
    );
  }

  async getUploadPresignedUrl(
    tenantId: string,
    fileName: string,
    contentType: string,
  ): Promise<PresignedUploadResult> {
    const s3Key = `${tenantId}/${fileName}`;
    const uploadUrl = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}?X-Amz-Expires=${this.defaultExpiration}&mock-upload=true`;

    this.logger.log(
      `[MockStorage] Generated presigned upload URL for s3://${this.bucketName}/${s3Key}`,
    );

    // In mock mode, pre-stage object entry so verification succeeds unless simulated otherwise
    this.objects.set(s3Key, {
      contentType,
      size: 1024,
    });

    return {
      uploadUrl,
      s3Key,
      expiresIn: this.defaultExpiration,
    };
  }

  async getDownloadPresignedUrl(
    s3Key: string,
    expiresInSeconds: number = 300,
  ): Promise<string> {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}?X-Amz-Expires=${expiresInSeconds}&mock-download=true`;
  }

  async writeMetadataJson(
    s3Key: string,
    metadata: IngestionMetadataV1,
  ): Promise<void> {
    this.logger.log(
      `[MockStorage] Writing metadata JSON to s3://${this.bucketName}/${s3Key}`,
    );
    this.metadataStore.set(s3Key, JSON.parse(JSON.stringify(metadata)));
    this.objects.set(s3Key, {
      contentType: 'application/json',
      size: Buffer.from(JSON.stringify(metadata)).length,
    });
  }

  async verifyObjectExists(s3Key: string): Promise<ObjectVerificationResult> {
    const obj = this.objects.get(s3Key);
    if (!obj) {
      return { exists: false };
    }
    return {
      exists: true,
      size: obj.size,
      etag: `mock-etag-${Date.now()}`,
      contentType: obj.contentType,
    };
  }

  async deleteFilePair(
    sourceS3Key: string,
    metadataS3Key: string,
  ): Promise<void> {
    this.logger.log(
      `[MockStorage] Deleting file pair: ${sourceS3Key} and ${metadataS3Key}`,
    );
    this.objects.delete(sourceS3Key);
    this.objects.delete(metadataS3Key);
    this.metadataStore.delete(metadataS3Key);
  }

  async uploadDirect(
    s3Key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<DirectUploadResult> {
    this.logger.log(
      `[MockStorage] Direct upload to s3://${this.bucketName}/${s3Key} (${buffer.length} bytes)`,
    );
    this.objects.set(s3Key, {
      buffer,
      contentType,
      size: buffer.length,
    });
    return {
      size: buffer.length,
      etag: `mock-direct-etag-${Date.now()}`,
    };
  }

  /**
   * Helper for tests
   */
  getStoredMetadata(s3Key: string): IngestionMetadataV1 | undefined {
    return this.metadataStore.get(s3Key);
  }

  /**
   * Helper for tests
   */
  clear(): void {
    this.objects.clear();
    this.metadataStore.clear();
  }
}
