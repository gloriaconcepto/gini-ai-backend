import { IngestionMetadataV1 } from '../documents.types';

export interface PresignedUploadResult {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface ObjectVerificationResult {
  exists: boolean;
  size?: number;
  etag?: string;
  contentType?: string;
}

export interface DirectUploadResult {
  size: number;
  etag?: string;
}

export interface IStorageService {
  getUploadPresignedUrl(
    tenantId: string,
    fileName: string,
    contentType: string,
  ): Promise<PresignedUploadResult>;

  getDownloadPresignedUrl(
    s3Key: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  writeMetadataJson(
    s3Key: string,
    metadata: IngestionMetadataV1,
  ): Promise<void>;

  verifyObjectExists(s3Key: string): Promise<ObjectVerificationResult>;

  deleteFilePair(
    sourceS3Key: string,
    metadataS3Key: string,
  ): Promise<void>;

  uploadDirect(
    s3Key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<DirectUploadResult>;
}

export const STORAGE_SERVICE_TOKEN = Symbol('IStorageService');
