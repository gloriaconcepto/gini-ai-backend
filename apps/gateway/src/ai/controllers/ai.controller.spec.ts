import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { LLM_PROVIDER_TOKEN } from '../interfaces/llm-provider.interface';
import { EMBEDDING_PROVIDER_TOKEN } from '../interfaces/embedding-provider.interface';
import { RagOrchestratorService } from '../services/rag-orchestrator.service';

describe('AiController', () => {
  let controller: AiController;
  let mockLlm: any;
  let mockEmbedding: any;
  let mockRagOrchestrator: any;

  beforeEach(async () => {
    mockLlm = {
      generateText: jest.fn().mockResolvedValue('Generated text response'),
    };
    mockEmbedding = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    };
    mockRagOrchestrator = {
      queryRag: jest.fn().mockResolvedValue({
        answer: 'RAG Answer',
        sources: [],
        retrievalMode: 'hybrid',
      }),
      indexChunks: jest.fn().mockResolvedValue({ indexed: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        {
          provide: LLM_PROVIDER_TOKEN,
          useValue: mockLlm,
        },
        {
          provide: EMBEDDING_PROVIDER_TOKEN,
          useValue: mockEmbedding,
        },
        {
          provide: RagOrchestratorService,
          useValue: mockRagOrchestrator,
        },
      ],
    }).compile();

    controller = module.get<AiController>(AiController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should generate text from LLM', async () => {
    const res = await controller.generateText({ prompt: 'Hello world' });
    expect(res.generatedText).toBe('Generated text response');
    expect(mockLlm.generateText).toHaveBeenCalledWith('Hello world', {
      maxTokens: undefined,
      temperature: undefined,
      topP: undefined,
    });
  });

  it('should generate vector embeddings', async () => {
    const res = await controller.generateEmbeddings({ text: 'Some enterprise text' });
    expect(res.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(res.dimension).toBe(3);
  });

  it('should route RAG query with tenantId extracted from request', async () => {
    const mockReq = {
      user: { tenantId: 'tenant-42' },
      headers: {},
    };

    const res = await controller.queryRag(mockReq, { query: 'Query question' });
    expect(res.answer).toBe('RAG Answer');
    expect(mockRagOrchestrator.queryRag).toHaveBeenCalledWith('tenant-42', {
      query: 'Query question',
    });
  });

  it('should index chunks for tenant', async () => {
    const mockReq = {
      headers: { 'x-tenant-id': 'tenant-header' },
    };

    const res = await controller.indexChunks(mockReq, [
      { chunkId: 'c1', documentId: 'd1', text: 'Text' },
    ]);
    expect(res.indexed).toBe(1);
    expect(mockRagOrchestrator.indexChunks).toHaveBeenCalledWith('tenant-header', [
      { chunkId: 'c1', documentId: 'd1', text: 'Text' },
    ]);
  });
});
