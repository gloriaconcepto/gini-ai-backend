export interface VectorChunk {
  chunkId: string;
  documentId: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface IVectorStore {
  /**
   * Indexes a single text chunk with its vector embedding under the tenant index.
   */
  indexChunk(tenantId: string, chunk: VectorChunk): Promise<void>;

  /**
   * Bulk indexes multiple text chunks for a tenant.
   */
  bulkIndexChunks(tenantId: string, chunks: VectorChunk[]): Promise<void>;

  /**
   * Performs k-NN dense vector similarity search.
   */
  similaritySearch(
    tenantId: string,
    queryVector: number[],
    topK?: number,
  ): Promise<VectorSearchResult[]>;

  /**
   * Performs hybrid search combining BM25 full-text keyword matching and k-NN vector search.
   */
  hybridSearch(
    tenantId: string,
    queryText: string,
    queryVector: number[],
    topK?: number,
  ): Promise<VectorSearchResult[]>;
}

export const VECTOR_STORE_TOKEN = Symbol('IVectorStore');
