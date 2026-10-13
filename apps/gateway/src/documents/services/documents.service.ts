import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as path from 'path';
import {
  DOCUMENT_REPOSITORY_TOKEN,
  DocumentEntity,
  DocumentFilter,
  DocumentUploadStatus,
  IngestionMetadataV1,
} from '../documents.types';
import type { IDocumentRepository } from '../documents.types';
import { STORAGE_SERVICE_TOKEN } from '../interfaces/storage-service.interface';
import type { IStorageService } from '../interfaces/storage-service.interface';
import { InitiateUploadDto } from '../dto/initiate-upload.dto';
import { UpdateDocumentAccessDto } from '../dto/update-access.dto';
import {
  DocumentListResponseDto,
  DocumentResponseDto,
  DocumentSummaryResponseDto,
  DownloadUrlResponseDto,
  UploadUrlResponseDto,
} from '../dto/document-response.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(DOCUMENT_REPOSITORY_TOKEN)
    private readonly repository: IDocumentRepository,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storage: IStorageService,
  ) {}

  private extractStemAndExtension(fileName: string): {
    stem: string;
    extension: string;
  } {
    const parsed = path.parse(fileName);
    const stem = parsed.name;
    const extension = parsed.ext;
    return { stem, extension };
  }

  async initiateUpload(
    tenantId: string,
    userId: string,
    dto: InitiateUploadDto,
  ): Promise<UploadUrlResponseDto> {
    const { stem, extension } = this.extractStemAndExtension(dto.fileName);
    const documentId = crypto.randomUUID();
    const contentType = dto.mimeType || 'application/octet-stream';

    // Required S3 File Pair: <tenant-id>/<stem>.<ext> and <tenant-id>/<stem>.metadata.json
    const s3Key = `${tenantId}/${dto.fileName}`;
    const metadataS3Key = `${tenantId}/${stem}.metadata.json`;

    const metadata: IngestionMetadataV1 = {
      schema_version: '1.0',
      tenant_id: tenantId,
      document: {
        document_id: stem,
        name: dto.name || stem,
        version: dto.version || '1.0',
        categories: dto.categories || [],
      },
      access: {
        departments: dto.departments || [],
        allowed_users: dto.allowedUsers || [],
        excluded_users: dto.excludedUsers || [],
      },
      metadata: {
        updated_at: new Date().toISOString(),
      },
    };

    const presigned = await this.storage.getUploadPresignedUrl(
      tenantId,
      dto.fileName,
      contentType,
    );

    const docEntity: DocumentEntity = {
      id: documentId,
      tenantId,
      fileName: dto.fileName,
      stem,
      extension,
      mimeType: contentType,
      fileSize: dto.fileSize || 0,
      s3Key,
      metadataS3Key,
      status: DocumentUploadStatus.PENDING_UPLOAD,
      metadata,
      uploadedBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.repository.create(docEntity);

    return {
      documentId,
      fileName: dto.fileName,
      stem,
      uploadUrl: presigned.uploadUrl,
      s3Key,
      metadataS3Key,
      expiresIn: presigned.expiresIn,
      status: DocumentUploadStatus.PENDING_UPLOAD,
    };
  }

  async completeUpload(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentResponseDto> {
    const doc = await this.repository.findById(tenantId, documentId);
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    // Verify object exists in S3
    const verification = await this.storage.verifyObjectExists(doc.s3Key);
    if (!verification.exists) {
      await this.repository.update(tenantId, documentId, {
        status: DocumentUploadStatus.FAILED,
        errorMessage: 'Source file does not exist on S3',
      });
      throw new BadRequestException(
        `Source document ${doc.fileName} was not found on S3 at ${doc.s3Key}`,
      );
    }

    // Write accompanying metadata JSON file using the same filename stem
    await this.storage.writeMetadataJson(doc.metadataS3Key, doc.metadata);

    const updated = await this.repository.update(tenantId, documentId, {
      status: DocumentUploadStatus.UPLOADED,
      fileSize: verification.size ?? doc.fileSize,
      uploadedAt: new Date().toISOString(),
      errorMessage: undefined,
    });

    this.logger.log(
      `Document ${doc.fileName} (id: ${documentId}) successfully completed and paired with ${doc.metadataS3Key}`,
    );

    return this.mapToResponseDto(updated!);
  }

  async uploadDirect(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: InitiateUploadDto,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required for direct upload');
    }

    const fileName = dto.fileName || file.originalname;
    const { stem, extension } = this.extractStemAndExtension(fileName);
    const documentId = crypto.randomUUID();
    const contentType = file.mimetype || 'application/octet-stream';

    const s3Key = `${tenantId}/${fileName}`;
    const metadataS3Key = `${tenantId}/${stem}.metadata.json`;

    const metadata: IngestionMetadataV1 = {
      schema_version: '1.0',
      tenant_id: tenantId,
      document: {
        document_id: stem,
        name: dto.name || stem,
        version: dto.version || '1.0',
        categories: dto.categories || [],
      },
      access: {
        departments: dto.departments || [],
        allowed_users: dto.allowedUsers || [],
        excluded_users: dto.excludedUsers || [],
      },
      metadata: {
        updated_at: new Date().toISOString(),
      },
    };

    // 1. Direct upload source file to S3
    const directResult = await this.storage.uploadDirect(
      s3Key,
      file.buffer,
      contentType,
    );

    // 2. Upload accompanying authorization metadata file
    await this.storage.writeMetadataJson(metadataS3Key, metadata);

    const docEntity: DocumentEntity = {
      id: documentId,
      tenantId,
      fileName,
      stem,
      extension,
      mimeType: contentType,
      fileSize: directResult.size,
      s3Key,
      metadataS3Key,
      status: DocumentUploadStatus.UPLOADED,
      metadata,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.repository.create(docEntity);

    return this.mapToResponseDto(docEntity);
  }

  async updateAccess(
    tenantId: string,
    documentId: string,
    dto: UpdateDocumentAccessDto,
  ): Promise<DocumentResponseDto> {
    const doc = await this.repository.findById(tenantId, documentId);
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const updatedMetadata: IngestionMetadataV1 = {
      ...doc.metadata,
      document: {
        ...doc.metadata.document,
        categories: dto.categories ?? doc.metadata.document.categories,
      },
      access: {
        departments: dto.departments ?? doc.metadata.access.departments,
        allowed_users: dto.allowedUsers ?? doc.metadata.access.allowed_users,
        excluded_users: dto.excludedUsers ?? doc.metadata.access.excluded_users,
      },
      metadata: {
        updated_at: new Date().toISOString(),
      },
    };

    // Update metadata JSON on S3 directly (without touching the PDF)
    await this.storage.writeMetadataJson(doc.metadataS3Key, updatedMetadata);

    const updatedDoc = await this.repository.update(tenantId, documentId, {
      metadata: updatedMetadata,
    });

    this.logger.log(
      `Updated authorization metadata for document ${documentId} on S3 at ${doc.metadataS3Key}`,
    );

    return this.mapToResponseDto(updatedDoc!);
  }

  async getDocument(
    tenantId: string,
    documentId: string,
  ): Promise<DocumentResponseDto> {
    const doc = await this.repository.findById(tenantId, documentId);
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return this.mapToResponseDto(doc);
  }

  async listDocuments(filter: DocumentFilter): Promise<DocumentListResponseDto> {
    const paginated = await this.repository.findMany(filter);
    return {
      items: paginated.items.map((item) => this.mapToResponseDto(item)),
      total: paginated.total,
      page: paginated.page,
      limit: paginated.limit,
      totalPages: paginated.totalPages,
    };
  }

  async getSummary(tenantId: string): Promise<DocumentSummaryResponseDto> {
    const summary = await this.repository.getSummary(tenantId);
    return {
      totalDocuments: summary.totalDocuments,
      totalSizeBytes: summary.totalSizeBytes,
      statusCounts: summary.statusCounts,
      categoryCounts: summary.categoryCounts,
    };
  }

  async getDownloadUrl(
    tenantId: string,
    documentId: string,
  ): Promise<DownloadUrlResponseDto> {
    const doc = await this.repository.findById(tenantId, documentId);
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    if (doc.status !== DocumentUploadStatus.UPLOADED) {
      throw new BadRequestException(
        `Cannot download document in "${doc.status}" state`,
      );
    }

    const downloadUrl = await this.storage.getDownloadPresignedUrl(doc.s3Key);
    return {
      downloadUrl,
      expiresIn: 300,
    };
  }

  async deleteDocument(
    tenantId: string,
    documentId: string,
  ): Promise<{ success: boolean; message: string }> {
    const doc = await this.repository.findById(tenantId, documentId);
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    // Delete both source file and metadata JSON from S3
    await this.storage.deleteFilePair(doc.s3Key, doc.metadataS3Key);

    await this.repository.delete(tenantId, documentId);

    return {
      success: true,
      message: `Document ${doc.fileName} and metadata successfully deleted from S3`,
    };
  }

  private mapToResponseDto(entity: DocumentEntity): DocumentResponseDto {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      fileName: entity.fileName,
      stem: entity.stem,
      extension: entity.extension,
      mimeType: entity.mimeType,
      fileSize: entity.fileSize,
      s3Key: entity.s3Key,
      metadataS3Key: entity.metadataS3Key,
      status: entity.status,
      metadata: entity.metadata,
      uploadedBy: entity.uploadedBy,
      uploadedAt: entity.uploadedAt,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      errorMessage: entity.errorMessage,
    };
  }
}
