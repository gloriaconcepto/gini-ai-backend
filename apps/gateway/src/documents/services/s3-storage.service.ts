import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  DirectUploadResult,
  IStorageService,
  ObjectVerificationResult,
  PresignedUploadResult,
} from '../interfaces/storage-service.interface';
import { IngestionMetadataV1 } from '../documents.types';

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly defaultExpiration: number;

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('AWS_S3_REGION') || 'us-west-2';
    this.bucketName =
      this.config.get<string>('AWS_S3_BUCKET_NAME') || 'gini-rag-documents';
    this.defaultExpiration = Number(
      this.config.get<number>('AWS_S3_PRESIGNED_EXPIRATION_SECONDS') || 900,
    );

    this.s3Client = new S3Client({
      region: this.region,
    });
  }

  async getUploadPresignedUrl(
    tenantId: string,
    fileName: string,
    contentType: string,
  ): Promise<PresignedUploadResult> {
    const s3Key = `${tenantId}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.defaultExpiration,
    });

    this.logger.log(
      `Generated presigned upload URL for s3://${this.bucketName}/${s3Key} (expires in ${this.defaultExpiration}s)`,
    );

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
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });
  }

  async writeMetadataJson(
    s3Key: string,
    metadata: IngestionMetadataV1,
  ): Promise<void> {
    const jsonBody = JSON.stringify(metadata, null, 2);
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: Buffer.from(jsonBody, 'utf-8'),
      ContentType: 'application/json',
    });

    await this.s3Client.send(command);
    this.logger.log(
      `Successfully wrote metadata JSON to s3://${this.bucketName}/${s3Key}`,
    );
  }

  async verifyObjectExists(s3Key: string): Promise<ObjectVerificationResult> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
      });

      const response = await this.s3Client.send(command);
      return {
        exists: true,
        size: response.ContentLength,
        etag: response.ETag,
        contentType: response.ContentType,
      };
    } catch (error: any) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404 ||
        error.name === 'NoSuchKey'
      ) {
        return { exists: false };
      }
      this.logger.error(
        `Failed to verify object s3://${this.bucketName}/${s3Key}: ${error.message}`,
      );
      throw error;
    }
  }

  async deleteFilePair(
    sourceS3Key: string,
    metadataS3Key: string,
  ): Promise<void> {
    await Promise.all([
      this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: sourceS3Key,
        }),
      ),
      this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: metadataS3Key,
        }),
      ),
    ]);

    this.logger.log(
      `Deleted S3 file pair: ${sourceS3Key} and ${metadataS3Key} from bucket ${this.bucketName}`,
    );
  }

  async uploadDirect(
    s3Key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<DirectUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
    });

    const response = await this.s3Client.send(command);
    this.logger.log(
      `Uploaded direct object to s3://${this.bucketName}/${s3Key} (${buffer.length} bytes)`,
    );

    return {
      size: buffer.length,
      etag: response.ETag,
    };
  }
}
