import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ChangeRequest,
  ChangeRequestActionType,
  ChangeRequestStatus,
} from '../entities/change-request.entity';

export interface CreateChangeRequestParams {
  tenantId: string;
  actionType: ChangeRequestActionType;
  targetResource: string;
  targetResourceId?: string;
  payload: Record<string, any>;
  makerId: string;
  makerUsername: string;
}

@Injectable()
export class ChangeRequestStoreService {
  private readonly store = new Map<string, ChangeRequest>();

  create(params: CreateChangeRequestParams): ChangeRequest {
    const id = randomUUID();
    const now = new Date();
    const request: ChangeRequest = {
      id,
      tenantId: params.tenantId,
      actionType: params.actionType,
      targetResource: params.targetResource,
      targetResourceId: params.targetResourceId,
      payload: params.payload,
      makerId: params.makerId,
      makerUsername: params.makerUsername,
      status: 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    this.store.set(id, request);
    return request;
  }

  findAll(tenantId: string, status?: ChangeRequestStatus): ChangeRequest[] {
    const results: ChangeRequest[] = [];
    for (const item of this.store.values()) {
      if (item.tenantId === tenantId) {
        if (!status || item.status === status) {
          results.push(item);
        }
      }
    }
    // Sort descending by createdAt
    return results.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  findById(tenantId: string, id: string): ChangeRequest | undefined {
    const request = this.store.get(id);
    if (!request || request.tenantId !== tenantId) {
      return undefined;
    }
    return request;
  }

  update(
    tenantId: string,
    id: string,
    updates: Partial<Omit<ChangeRequest, 'id' | 'tenantId' | 'createdAt'>>,
  ): ChangeRequest {
    const request = this.findById(tenantId, id);
    if (!request) {
      throw new NotFoundException(`Change request with ID '${id}' not found`);
    }

    const updated: ChangeRequest = {
      ...request,
      ...updates,
      updatedAt: new Date(),
    };

    this.store.set(id, updated);
    return updated;
  }

  clear(): void {
    this.store.clear();
  }
}
