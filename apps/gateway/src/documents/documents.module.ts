import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentsService } from './services/documents.service';
import { S3StorageService } from './services/s3-storage.service';
import { MockStorageService } from './services/mock-storage.service';
import { InMemoryDocumentRepository } from './adapters/in-memory-document.repository';
import { DOCUMENT_REPOSITORY_TOKEN } from './documents.types';
import { STORAGE_SERVICE_TOKEN } from './interfaces/storage-service.interface';

@Module({
  imports: [ConfigModule],
  controllers: [DocumentsController],
  providers: [
    InMemoryDocumentRepository,
    S3StorageService,
    MockStorageService,
    {
      provide: DOCUMENT_REPOSITORY_TOKEN,
      useClass: InMemoryDocumentRepository,
    },
    {
      provide: STORAGE_SERVICE_TOKEN,
      useFactory: (
        config: ConfigService,
        s3: S3StorageService,
        mock: MockStorageService,
      ) => {
        const storageMode = config
          .get<string>('DOCUMENT_STORAGE_MODE')
          ?.toLowerCase();
        if (storageMode === 'local' || storageMode === 'mock') {
          return mock;
        }
        const useAws =
          storageMode === 'remote' ||
          config.get<string>('NODE_ENV') === 'production' ||
          config.get<string>('APP_ENV') === 'remote';
        return useAws ? s3 : mock;
      },
      inject: [ConfigService, S3StorageService, MockStorageService],
    },
    DocumentsService,
  ],
  exports: [
    DocumentsService,
    DOCUMENT_REPOSITORY_TOKEN,
    STORAGE_SERVICE_TOKEN,
  ],
})
export class DocumentsModule {}
