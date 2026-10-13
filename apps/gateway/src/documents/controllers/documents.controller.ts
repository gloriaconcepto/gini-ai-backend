import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from '../services/documents.service';
import { InitiateUploadDto } from '../dto/initiate-upload.dto';
import { UpdateDocumentAccessDto } from '../dto/update-access.dto';
import {
  DocumentListResponseDto,
  DocumentResponseDto,
  DocumentSummaryResponseDto,
  DownloadUrlResponseDto,
  UploadUrlResponseDto,
} from '../dto/document-response.dto';
import { DocumentUploadStatus } from '../documents.types';

@ApiTags('Document Management & Ingestion')
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Tenant-ID',
  description: 'Target tenant identifier for multi-tenant document isolation',
  required: false,
})
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private extractTenantId(req: any): string {
    return (
      req.user?.tenantId ||
      req.headers['x-tenant-id'] ||
      'default-tenant'
    );
  }

  private extractUserId(req: any): string {
    return req.user?.userId || req.user?.sub || 'system-user';
  }

  @Post('upload-url')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Generate presigned S3 direct upload URL',
    description:
      'Creates a document record in PENDING_UPLOAD status and generates an S3 presigned PUT URL for direct-to-S3 upload in the tenant directory.',
  })
  @ApiResponse({
    status: 201,
    description: 'Presigned upload URL generated successfully.',
    type: UploadUrlResponseDto,
  })
  async generateUploadUrl(
    @Req() req: any,
    @Body() dto: InitiateUploadDto,
  ): Promise<UploadUrlResponseDto> {
    const tenantId = this.extractTenantId(req);
    const userId = this.extractUserId(req);
    return this.documentsService.initiateUpload(tenantId, userId, dto);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Direct multipart file upload to S3',
    description:
      'Directly streams an uploaded file to the tenant directory on S3 and immediately writes its accompanying .metadata.json file.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        name: { type: 'string', example: 'Performance Policy' },
        version: { type: 'string', example: '1.0' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          example: ['security-risk'],
        },
        departments: {
          type: 'array',
          items: { type: 'string' },
          example: ['technology'],
        },
        allowedUsers: {
          type: 'array',
          items: { type: 'string' },
          example: [],
        },
        excludedUsers: {
          type: 'array',
          items: { type: 'string' },
          example: ['user-alex-rivera'],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File and metadata uploaded successfully.',
    type: DocumentResponseDto,
  })
  async directUpload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ): Promise<DocumentResponseDto> {
    const tenantId = this.extractTenantId(req);
    const userId = this.extractUserId(req);

    const dto: InitiateUploadDto = {
      fileName: file?.originalname || body.fileName,
      name: body.name,
      version: body.version,
      categories: Array.isArray(body.categories)
        ? body.categories
        : body.categories
          ? [body.categories]
          : [],
      departments: Array.isArray(body.departments)
        ? body.departments
        : body.departments
          ? [body.departments]
          : [],
      allowedUsers: Array.isArray(body.allowedUsers)
        ? body.allowedUsers
        : body.allowedUsers
          ? [body.allowedUsers]
          : [],
      excludedUsers: Array.isArray(body.excludedUsers)
        ? body.excludedUsers
        : body.excludedUsers
          ? [body.excludedUsers]
          : [],
      mimeType: file?.mimetype,
      fileSize: file?.size,
    };

    return this.documentsService.uploadDirect(tenantId, userId, file, dto);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm direct S3 upload completion',
    description:
      'Verifies the uploaded file exists on S3, writes the paired .metadata.json file, and transitions state to UPLOADED.',
  })
  @ApiResponse({
    status: 200,
    description: 'Document upload confirmed and metadata written.',
    type: DocumentResponseDto,
  })
  async completeUpload(
    @Req() req: any,
    @Param('id') documentId: string,
  ): Promise<DocumentResponseDto> {
    const tenantId = this.extractTenantId(req);
    return this.documentsService.completeUpload(tenantId, documentId);
  }

  @Patch(':id/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update authorization metadata for document',
    description:
      'Updates access control rules and rewrites the .metadata.json file directly on S3 without re-uploading the source document.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authorization metadata updated successfully.',
    type: DocumentResponseDto,
  })
  async updateAccess(
    @Req() req: any,
    @Param('id') documentId: string,
    @Body() dto: UpdateDocumentAccessDto,
  ): Promise<DocumentResponseDto> {
    const tenantId = this.extractTenantId(req);
    return this.documentsService.updateAccess(tenantId, documentId, dto);
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get document upload statistics and summary',
    description:
      'Returns aggregate document metrics, status distribution, and category counts for the authenticated tenant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary statistics retrieved successfully.',
    type: DocumentSummaryResponseDto,
  })
  async getSummary(@Req() req: any): Promise<DocumentSummaryResponseDto> {
    const tenantId = this.extractTenantId(req);
    return this.documentsService.getSummary(tenantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get document details and upload status',
    description:
      'Retrieves the current metadata, upload status, S3 paths, and authorization rules for a specific document.',
  })
  @ApiResponse({
    status: 200,
    description: 'Document details retrieved successfully.',
    type: DocumentResponseDto,
  })
  async getDocument(
    @Req() req: any,
    @Param('id') documentId: string,
  ): Promise<DocumentResponseDto> {
    const tenantId = this.extractTenantId(req);
    return this.documentsService.getDocument(tenantId, documentId);
  }

  @Get(':id/download-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate presigned S3 download URL',
    description:
      'Generates a temporary presigned GET URL to securely download the source document from S3.',
  })
  @ApiResponse({
    status: 200,
    description: 'Download URL generated successfully.',
    type: DownloadUrlResponseDto,
  })
  async getDownloadUrl(
    @Req() req: any,
    @Param('id') documentId: string,
  ): Promise<DownloadUrlResponseDto> {
    const tenantId = this.extractTenantId(req);
    return this.documentsService.getDownloadUrl(tenantId, documentId);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List tenant documents',
    description:
      'Retrieves a paginated list of tenant documents with optional status, category, department, and search filters.',
  })
  @ApiQuery({ name: 'status', required: false, enum: DocumentUploadStatus })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'List of documents retrieved successfully.',
    type: DocumentListResponseDto,
  })
  async listDocuments(
    @Req() req: any,
    @Query('status') status?: DocumentUploadStatus,
    @Query('category') category?: string,
    @Query('department') department?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<DocumentListResponseDto> {
    const tenantId = this.extractTenantId(req);
    return this.documentsService.listDocuments({
      tenantId,
      status,
      category,
      department,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete document and S3 file pair',
    description:
      'Purges the document and its matching .metadata.json file from S3 and marks the document deleted.',
  })
  @ApiResponse({
    status: 200,
    description: 'Document deleted successfully.',
  })
  async deleteDocument(
    @Req() req: any,
    @Param('id') documentId: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = this.extractTenantId(req);
    return this.documentsService.deleteDocument(tenantId, documentId);
  }
}
