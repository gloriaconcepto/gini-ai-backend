export interface IEmbeddingProvider {
  /**
   * Generates a dense vector embedding for a single text input.
   */
  generateEmbedding(text: string): Promise<number[]>;

  /**
   * Generates dense vector embeddings for a batch of text inputs.
   */
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER_TOKEN = Symbol('IEmbeddingProvider');
