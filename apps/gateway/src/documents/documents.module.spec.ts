import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentsModule } from './documents.module';
import { DocumentsService } from './services/documents.service';
import {
  DOCUMENT_REPOSITORY_TOKEN,
  IDocumentRepository,
} from './documents.types';
import {
  IStorageService,
  STORAGE_SERVICE_TOKEN,
} from './interfaces/storage-service.interface';
import { S3StorageService } from './services/s3-storage.service';
import { MockStorageService } from './services/mock-storage.service';

describe('DocumentsModule', () => {
  it('should compile and provide MockStorageService in local environment', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ NODE_ENV: 'development', APP_ENV: 'local' })],
        }),
        DocumentsModule,
      ],
    }).compile();

    const service = moduleRef.get<DocumentsService>(DocumentsService);
    const repo = moduleRef.get<IDocumentRepository>(DOCUMENT_REPOSITORY_TOKEN);
    const storage = moduleRef.get<IStorageService>(STORAGE_SERVICE_TOKEN);

    expect(service).toBeDefined();
    expect(repo).toBeDefined();
    expect(storage).toBeInstanceOf(MockStorageService);
  });

  it('should provide S3StorageService when APP_ENV is remote', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ APP_ENV: 'remote' })],
        }),
        DocumentsModule,
      ],
    }).compile();

    const storage = moduleRef.get<IStorageService>(STORAGE_SERVICE_TOKEN);
    expect(storage).toBeInstanceOf(S3StorageService);
  });

  it('should provide S3StorageService in local environment when DOCUMENT_STORAGE_MODE is remote', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'development',
              APP_ENV: 'local',
              DOCUMENT_STORAGE_MODE: 'remote',
            }),
          ],
        }),
        DocumentsModule,
      ],
    }).compile();

    const storage = moduleRef.get<IStorageService>(STORAGE_SERVICE_TOKEN);
    expect(storage).toBeInstanceOf(S3StorageService);
  });

  it('should provide MockStorageService when DOCUMENT_STORAGE_MODE is local even if NODE_ENV is production', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              NODE_ENV: 'production',
              DOCUMENT_STORAGE_MODE: 'local',
            }),
          ],
        }),
        DocumentsModule,
      ],
    }).compile();

    const storage = moduleRef.get<IStorageService>(STORAGE_SERVICE_TOKEN);
    expect(storage).toBeInstanceOf(MockStorageService);
  });
});
