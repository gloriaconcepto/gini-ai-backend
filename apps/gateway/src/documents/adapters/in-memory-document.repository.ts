import { Injectable } from '@nestjs/common';
import {
  DocumentEntity,
  DocumentFilter,
  DocumentSummaryMetrics,
  DocumentUploadStatus,
  IDocumentRepository,
  PaginatedDocuments,
} from '../documents.types';

@Injectable()
export class InMemoryDocumentRepository implements IDocumentRepository {
  private documents: Map<string, DocumentEntity> = new Map();

  private getCompositeKey(tenantId: string, id: string): string {
    return `${tenantId}:${id}`;
  }

  async create(doc: DocumentEntity): Promise<DocumentEntity> {
    const key = this.getCompositeKey(doc.tenantId, doc.id);
    const clone = JSON.parse(JSON.stringify(doc));
    this.documents.set(key, clone);
    return clone;
  }

  async findById(tenantId: string, id: string): Promise<DocumentEntity | null> {
    const key = this.getCompositeKey(tenantId, id);
    const doc = this.documents.get(key);
    if (!doc || doc.status === DocumentUploadStatus.DELETED) {
      return null;
    }
    return JSON.parse(JSON.stringify(doc));
  }

  async findByStem(
    tenantId: string,
    stem: string,
  ): Promise<DocumentEntity | null> {
    for (const doc of this.documents.values()) {
      if (
        doc.tenantId === tenantId &&
        doc.stem === stem &&
        doc.status !== DocumentUploadStatus.DELETED
      ) {
        return JSON.parse(JSON.stringify(doc));
      }
    }
    return null;
  }

  private compareVersions(v1?: string, v2?: string): number {
    const parse = (v?: string): number[] => {
      if (!v) return [0];
      return v
        .replace(/^v/i, '')
        .split('.')
        .map((p) => {
          const num = parseInt(p, 10);
          return isNaN(num) ? 0 : num;
        });
    };
    const parts1 = parse(v1);
    const parts2 = parse(v2);
    const maxLen = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  async findLatestVersion(
    tenantId: string,
    baseStem: string,
    extension: string,
  ): Promise<DocumentEntity | null> {
    const normalizedExt = extension.toLowerCase();
    const normalizedStem = baseStem.toLowerCase();

    let latestDoc: DocumentEntity | null = null;

    for (const doc of this.documents.values()) {
      if (
        doc.tenantId === tenantId &&
        doc.stem.toLowerCase() === normalizedStem &&
        doc.extension.toLowerCase() === normalizedExt &&
        doc.status !== DocumentUploadStatus.DELETED
      ) {
        if (
          !latestDoc ||
          this.compareVersions(doc.version, latestDoc.version) > 0
        ) {
          latestDoc = doc;
        }
      }
    }

    return latestDoc ? JSON.parse(JSON.stringify(latestDoc)) : null;
  }

  async update(
    tenantId: string,
    id: string,
    partial: Partial<DocumentEntity>,
  ): Promise<DocumentEntity | null> {
    const key = this.getCompositeKey(tenantId, id);
    const existing = this.documents.get(key);
    if (!existing || existing.status === DocumentUploadStatus.DELETED) {
      return null;
    }

    const updated: DocumentEntity = {
      ...existing,
      ...partial,
      tenantId: existing.tenantId,
      id: existing.id,
      updatedAt: new Date().toISOString(),
    };

    this.documents.set(key, updated);
    return JSON.parse(JSON.stringify(updated));
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const key = this.getCompositeKey(tenantId, id);
    const existing = this.documents.get(key);
    if (!existing || existing.status === DocumentUploadStatus.DELETED) {
      return false;
    }

    existing.status = DocumentUploadStatus.DELETED;
    existing.updatedAt = new Date().toISOString();
    this.documents.set(key, existing);
    return true;
  }

  async findMany(filter: DocumentFilter): Promise<PaginatedDocuments> {
    const {
      tenantId,
      status,
      category,
      department,
      search,
      page = 1,
      limit = 20,
    } = filter;

    let items: DocumentEntity[] = [];

    for (const doc of this.documents.values()) {
      if (doc.tenantId !== tenantId) {
        continue;
      }
      if (doc.status === DocumentUploadStatus.DELETED) {
        continue;
      }
      if (status && doc.status !== status) {
        continue;
      }
      if (
        category &&
        !doc.metadata.document.categories.some(
          (c) => c.toLowerCase() === category.toLowerCase(),
        )
      ) {
        continue;
      }
      if (
        department &&
        !doc.metadata.access.departments?.some(
          (d) => d.toLowerCase() === department.toLowerCase(),
        )
      ) {
        continue;
      }
      if (search) {
        const query = search.toLowerCase();
        const matchesName = doc.metadata.document.name
          .toLowerCase()
          .includes(query);
        const matchesFileName = doc.fileName.toLowerCase().includes(query);
        const matchesStem = doc.stem.toLowerCase().includes(query);
        if (!matchesName && !matchesFileName && !matchesStem) {
          continue;
        }
      }
      items.push(JSON.parse(JSON.stringify(doc)));
    }

    // Sort descending by createdAt
    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const total = items.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getSummary(tenantId: string): Promise<DocumentSummaryMetrics> {
    let totalDocuments = 0;
    let totalSizeBytes = 0;

    const statusCounts: Record<DocumentUploadStatus, number> = {
      [DocumentUploadStatus.PENDING_UPLOAD]: 0,
      [DocumentUploadStatus.UPLOADING]: 0,
      [DocumentUploadStatus.UPLOADED]: 0,
      [DocumentUploadStatus.FAILED]: 0,
      [DocumentUploadStatus.DELETED]: 0,
    };

    const categoryCounts: Record<string, number> = {};

    for (const doc of this.documents.values()) {
      if (
        doc.tenantId !== tenantId ||
        doc.status === DocumentUploadStatus.DELETED
      ) {
        continue;
      }

      totalDocuments++;
      if (doc.status === DocumentUploadStatus.UPLOADED) {
        totalSizeBytes += doc.fileSize || 0;
      }

      statusCounts[doc.status] = (statusCounts[doc.status] || 0) + 1;

      for (const cat of doc.metadata.document.categories || []) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }

    return {
      totalDocuments,
      totalSizeBytes,
      statusCounts,
      categoryCounts,
    };
  }

  /**
   * Helper for tests
   */
  clear(): void {
    this.documents.clear();
  }
}
