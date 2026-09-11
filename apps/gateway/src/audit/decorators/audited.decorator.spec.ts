import {
  Audited,
  SkipAudit,
  AUDIT_METADATA_KEY,
  SKIP_AUDIT_METADATA_KEY,
} from './audited.decorator';
import { AuditActionCategory } from '../audit.types';

describe('Audit Decorators', () => {
  it('should set default audit metadata when called with no arguments', () => {
    class TestClass {
      @Audited()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      AUDIT_METADATA_KEY,
      TestClass.prototype.testMethod,
    );
    expect(metadata).toEqual({});
  });

  it('should set custom audit metadata when options are provided', () => {
    class TestClass {
      @Audited({
        category: AuditActionCategory.IAM,
        operation: 'TEST_OP',
        resourceType: 'user',
      })
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      AUDIT_METADATA_KEY,
      TestClass.prototype.testMethod,
    );
    expect(metadata).toEqual({
      category: AuditActionCategory.IAM,
      operation: 'TEST_OP',
      resourceType: 'user',
    });
  });

  it('should set skip audit metadata', () => {
    class TestClass {
      @SkipAudit()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      SKIP_AUDIT_METADATA_KEY,
      TestClass.prototype.testMethod,
    );
    expect(metadata).toBe(true);
  });
});
