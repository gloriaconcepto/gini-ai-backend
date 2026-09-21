import { Injectable, Logger } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { ILlmProvider, LlmGenerateOptions } from '../interfaces/llm-provider.interface';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import {
  IVectorStore,
  VectorChunk,
  VectorSearchResult,
} from '../interfaces/vector-store.interface';

@Injectable()
export class MockLlmService implements ILlmProvider, IEmbeddingProvider, IVectorStore {
  private readonly logger = new Logger(MockLlmService.name);
  private readonly inMemoryVectors: Map<string, VectorChunk[]> = new Map();

  // --- ILlmProvider ---
  async generateText(prompt: string, options?: LlmGenerateOptions): Promise<string> {
    this.logger.log(`[MockLLM] generateText called with prompt: "${prompt.slice(0, 60)}..."`);
    return `[Mock AI Response] Grounded answer generated for prompt: "${prompt.slice(0, 50)}...". All Maker-Checker governance rules verified.`;
  }

  streamText(prompt: string, options?: LlmGenerateOptions): Observable<string> {
    this.logger.log(`[MockLLM] streamText called with prompt: "${prompt.slice(0, 60)}..."`);
    return of(
      '[Mock AI Stream Chunk 1] ',
      'Enterprise intelligence verified. ',
      '[Mock AI Stream Chunk 2] Completed.',
    );
  }

  // --- IEmbeddingProvider ---
  async generateEmbedding(text: string): Promise<number[]> {
    this.logger.log(`[MockEmbedding] generateEmbedding for: "${text.slice(0, 40)}..."`);
    // Return deterministic 1024-dimension pseudo-vector based on character codes
    const vector = new Array(1024).fill(0).map((_, i) => {
      const charCode = text.charCodeAt(i % text.length) || 42;
      return Number(((charCode % 100) / 100).toFixed(4));
    });
    return vector;
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }

  // --- IVectorStore ---
  async indexChunk(tenantId: string, chunk: VectorChunk): Promise<void> {
    this.logger.log(`[MockVectorStore] Indexing chunk ${chunk.chunkId} for tenant ${tenantId}`);
    const chunks = this.inMemoryVectors.get(tenantId) || [];
    chunks.push(chunk);
    this.inMemoryVectors.set(tenantId, chunks);
  }

  async bulkIndexChunks(tenantId: string, chunks: VectorChunk[]): Promise<void> {
    for (const chunk of chunks) {
      await this.indexChunk(tenantId, chunk);
    }
  }

  async similaritySearch(
    tenantId: string,
    queryVector: number[],
    topK = 5,
  ): Promise<VectorSearchResult[]> {
    const chunks = this.inMemoryVectors.get(tenantId) || [];
    return chunks.slice(0, topK).map((c, idx) => ({
      chunkId: c.chunkId,
      documentId: c.documentId,
      text: c.text,
      score: Number((0.95 - idx * 0.05).toFixed(3)),
      metadata: c.metadata,
    }));
  }

  async hybridSearch(
    tenantId: string,
    queryText: string,
    queryVector: number[],
    topK = 5,
  ): Promise<VectorSearchResult[]> {
    this.logger.log(`[MockVectorStore] Hybrid search for tenant ${tenantId} text: "${queryText}"`);
    return this.similaritySearch(tenantId, queryVector, topK);
  }
}
