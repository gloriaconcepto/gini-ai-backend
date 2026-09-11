import { Test } from '@nestjs/testing';
import { AuditModule } from './audit.module';
import { AuditService } from './services/audit.service';
import { AuditMaskingService } from './services/audit-masking.service';
import { InMemoryAuditStorageAdapter } from './adapters/in-memory-audit-storage.adapter';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { AuditorGuard } from './guards/auditor.guard';
import { AuditController } from './controllers/audit.controller';

describe('AuditModule', () => {
  it('should compile the module and resolve providers and controllers', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuditModule],
    }).compile();

    expect(moduleRef.get(AuditService)).toBeDefined();
    expect(moduleRef.get(AuditMaskingService)).toBeDefined();
    expect(moduleRef.get(InMemoryAuditStorageAdapter)).toBeDefined();
    expect(moduleRef.get(AuditLogInterceptor)).toBeDefined();
    expect(moduleRef.get(AuditorGuard)).toBeDefined();
    expect(moduleRef.get(AuditController)).toBeDefined();
  });
});
