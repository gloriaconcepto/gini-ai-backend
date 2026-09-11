import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditMaskingService {
  private static readonly DEFAULT_SENSITIVE_KEYS = new Set([
    'password',
    'adminpassword',
    'makerpassword',
    'checkerpassword',
    'secret',
    'clientsecret',
    'apikey',
    'key',
    'token',
    'accesstoken',
    'refreshtoken',
    'authorization',
    'taxid',
    'ssn',
    'privatekey',
    'credential',
    'credentials',
  ]);

  private static readonly JWT_REGEX =
    /eyJ[a-zA-Z0-9_-]{5,}\.eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/g;
  private static readonly BEARER_REGEX = /Bearer\s+[a-zA-Z0-9._-]+/gi;
  private static readonly CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b(?!\d)/g;

  /**
   * Recursively masks sensitive fields and patterns in an object or primitive.
   */
  mask<T>(data: T, customSensitiveKeys: string[] = []): T {
    if (data === null || data === undefined) {
      return data;
    }

    const sensitiveKeys = new Set([
      ...Array.from(AuditMaskingService.DEFAULT_SENSITIVE_KEYS),
      ...customSensitiveKeys.map((k) => k.toLowerCase()),
    ]);

    return this.maskRecursive(data, sensitiveKeys, new WeakSet()) as T;
  }

  private maskRecursive(
    value: unknown,
    sensitiveKeys: Set<string>,
    seen: WeakSet<object>,
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.maskStringPatterns(value);
    }

    if (typeof value !== 'object') {
      return value;
    }

    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.maskRecursive(item, sensitiveKeys, seen));
    }

    const maskedObject: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.has(lowerKey)) {
        maskedObject[key] = '[REDACTED]';
      } else {
        maskedObject[key] = this.maskRecursive(val, sensitiveKeys, seen);
      }
    }

    return maskedObject;
  }

  /**
   * Applies regex patterns to string values to mask embedded tokens and cards.
   */
  private maskStringPatterns(str: string): string {
    let result = str;
    if (AuditMaskingService.BEARER_REGEX.test(result)) {
      result = result.replace(
        AuditMaskingService.BEARER_REGEX,
        'Bearer [REDACTED]',
      );
    }
    if (AuditMaskingService.JWT_REGEX.test(result)) {
      result = result.replace(AuditMaskingService.JWT_REGEX, '[REDACTED_JWT]');
    }
    if (AuditMaskingService.CREDIT_CARD_REGEX.test(result)) {
      result = result.replace(
        AuditMaskingService.CREDIT_CARD_REGEX,
        '[REDACTED_CARD]',
      );
    }
    return result;
  }
}
