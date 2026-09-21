import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { API_KEY_CONFIG } from '../constants/auth.constants';

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  hashedKey: string;
  createdAt: Date;
  expiresAt?: Date;
  revokedAt?: Date;
}

export interface CreatedApiKeyResult {
  id: string;
  name: string;
  apiKey: string;
  keyPrefix: string;
  createdAt: Date;
  expiresAt?: Date;
}

@Injectable()
export class ApiKeyService {
  // In-memory registry for Phase 1 (persisted to Drizzle ORM in Phase 2)
  private readonly apiKeys = new Map<string, ApiKeyRecord>();

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async generateApiKey(
    tenantId: string,
    name: string,
    expiresInDays?: number,
  ): Promise<CreatedApiKeyResult> {
    const id = randomUUID();
    const secret = randomBytes(API_KEY_CONFIG.ENTROPY_BYTES).toString('hex');
    const rawKey = `${API_KEY_CONFIG.PREFIX}${secret}`;
    const keyPrefix = rawKey.substring(0, API_KEY_CONFIG.PREFIX_DISPLAY_LENGTH);
    const hashedKey = this.hashKey(rawKey);

    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * API_KEY_CONFIG.MS_PER_DAY)
      : undefined;

    const record: ApiKeyRecord = {
      id,
      tenantId,
      name,
      keyPrefix,
      hashedKey,
      createdAt: now,
      expiresAt,
    };

    this.apiKeys.set(id, record);

    return {
      id,
      name,
      apiKey: rawKey,
      keyPrefix,
      createdAt: now,
      expiresAt,
    };
  }

  async listApiKeys(
    tenantId: string,
  ): Promise<Omit<ApiKeyRecord, 'hashedKey'>[]> {
    const list: Omit<ApiKeyRecord, 'hashedKey'>[] = [];
    for (const record of this.apiKeys.values()) {
      if (record.tenantId === tenantId) {
        const { hashedKey, ...meta } = record;
        list.push(meta);
      }
    }
    return list;
  }

  async revokeApiKey(
    tenantId: string,
    keyId: string,
  ): Promise<{ success: boolean; id: string }> {
    const record = this.apiKeys.get(keyId);
    if (!record || record.tenantId !== tenantId) {
      throw new NotFoundException(`API key with ID ${keyId} not found`);
    }

    record.revokedAt = new Date();
    this.apiKeys.set(keyId, record);
    return { success: true, id: keyId };
  }

  async validateApiKey(
    rawKey: string,
  ): Promise<{ valid: boolean; record?: ApiKeyRecord }> {
    if (!rawKey || !rawKey.startsWith(API_KEY_CONFIG.PREFIX)) {
      return { valid: false };
    }

    const hashed = this.hashKey(rawKey);
    const now = new Date();

    for (const record of this.apiKeys.values()) {
      if (record.hashedKey === hashed) {
        if (record.revokedAt) {
          return { valid: false };
        }
        if (record.expiresAt && record.expiresAt < now) {
          return { valid: false };
        }
        return { valid: true, record };
      }
    }

    return { valid: false };
  }
}
