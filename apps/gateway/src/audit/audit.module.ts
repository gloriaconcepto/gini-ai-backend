import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { InMemoryAuditStorageAdapter } from './adapters/in-memory-audit-storage.adapter';
import { AuditMaskingService } from './services/audit-masking.service';
import { AuditService } from './services/audit.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditorGuard } from './guards/auditor.guard';
import { AuditController } from './controllers/audit.controller';

@Module({
  imports: [PassportModule],
  providers: [
    InMemoryAuditStorageAdapter,
    AuditMaskingService,
    AuditService,
    AuditLogInterceptor,
    AuditorGuard,
  ],
  controllers: [AuditController],
  exports: [
    AuditService,
    AuditMaskingService,
    AuditLogInterceptor,
    AuditorGuard,
    InMemoryAuditStorageAdapter,
  ],
})
export class AuditModule {}
