import { SetMetadata } from '@nestjs/common';
import { AuditDecoratorOptions } from '../audit.types';

export const AUDIT_METADATA_KEY = 'audit:metadata';
export const SKIP_AUDIT_METADATA_KEY = 'audit:skip';

/**
 * Decorator to attach audit logging configuration to a route handler or controller.
 */
export const Audited = (options: AuditDecoratorOptions = {}) =>
  SetMetadata(AUDIT_METADATA_KEY, options);

/**
 * Decorator to explicitly skip audit logging for high-frequency or unneeded routes (e.g. health checks).
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_METADATA_KEY, true);
