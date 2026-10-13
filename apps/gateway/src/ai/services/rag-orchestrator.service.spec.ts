import { RagOrchestratorService } from './rag-orchestrator.service';
import { ILlmProvider } from '../interfaces/llm-provider.interface';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { IVectorStore } from '../interfaces/vector-store.interface';

describe('RagOrchestratorService', () => {
  let service: RagOrchestratorService;
  let mockLlm: jest.Mocked<ILlmProvider>;
  let mockEmbedding: jest.Mocked<IEmbeddingProvider>;
  let mockVectorStore: jest.Mocked<IVectorStore>;

  beforeEach(() => {
    mockLlm = {
      generateText: jest.fn().mockResolvedValue('Grounded AI Answer'),
      streamText: jest.fn(),
    };

    mockEmbedding = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      generateBatchEmbeddings: jest.fn().mockResolvedValue([[0.1, 0.2], [0.3, 0.4]]),
    };

    mockVectorStore = {
      indexChunk: jest.fn().mockResolvedValue(undefined),
      bulkIndexChunks: jest.fn().mockResolvedValue(undefined),
      similaritySearch: jest.fn().mockResolvedValue([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          text: 'Dual control policy requires maker and checker.',
          score: 0.89,
          metadata: { page: 1 },
        },
      ]),
      hybridSearch: jest.fn().mockResolvedValue([
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          text: 'Dual control policy requires maker and checker.',
          score: 0.95,
          metadata: { page: 1 },
        },
      ]),
    };

    service = new RagOrchestratorService(mockLlm, mockEmbedding, mockVectorStore);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute end-to-end RAG query with hybrid search', async () => {
    const result = await service.queryRag('tenant-1', {
      query: 'What is dual control?',
      topK: 3,
      useHybridSearch: true,
    });

    expect(mockEmbedding.generateEmbedding).toHaveBeenCalledWith('What is dual control?');
    expect(mockVectorStore.hybridSearch).toHaveBeenCalledWith(
      'tenant-1',
      'What is dual control?',
      [0.1, 0.2, 0.3],
      3,
    );
    expect(mockLlm.generateText).toHaveBeenCalledWith(
      expect.stringContaining('Dual control policy requires maker and checker.'),
      expect.any(Object),
    );

    expect(result.answer).toBe('Grounded AI Answer');
    expect(result.sources).toHaveLength(1);
    expect(result.retrievalMode).toBe('hybrid (k-NN + BM25)');
  });

  it('should support vector-only search when useHybridSearch is false', async () => {
    await service.queryRag('tenant-1', {
      query: 'What is dual control?',
      topK: 5,
      useHybridSearch: false,
    });

    expect(mockVectorStore.similaritySearch).toHaveBeenCalled();
    expect(mockVectorStore.hybridSearch).not.toHaveBeenCalled();
  });

  it('should index document chunks in batch', async () => {
    const res = await service.indexChunks('tenant-1', [
      { chunkId: 'c1', documentId: 'd1', text: 'Text 1' },
      { chunkId: 'c2', documentId: 'd1', text: 'Text 2' },
    ]);

    expect(res.indexed).toBe(2);
    expect(mockEmbedding.generateBatchEmbeddings).toHaveBeenCalledWith(['Text 1', 'Text 2']);
    expect(mockVectorStore.bulkIndexChunks).toHaveBeenCalledTimes(1);
  });
});
