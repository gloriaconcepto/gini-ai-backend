import { MockLlmService } from './mock-llm.service';

describe('MockLlmService', () => {
  let service: MockLlmService;

  beforeEach(() => {
    service = new MockLlmService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate text mock response', async () => {
    const text = await service.generateText('Test prompt');
    expect(text).toContain('[Mock AI Response]');
    expect(text).toContain('Maker-Checker');
  });

  it('should stream text chunks', (done) => {
    const chunks: string[] = [];
    service.streamText('Stream prompt').subscribe({
      next: (chunk) => chunks.push(chunk),
      complete: () => {
        expect(chunks.length).toBeGreaterThan(0);
        done();
      },
    });
  });

  it('should generate deterministic 1024-dimension embeddings', async () => {
    const embedding = await service.generateEmbedding('hello world');
    expect(embedding).toHaveLength(1024);
    expect(typeof embedding[0]).toBe('number');
  });

  it('should index chunks and perform hybrid search', async () => {
    await service.indexChunk('tenant-1', {
      chunkId: 'c1',
      documentId: 'd1',
      text: 'Maker-Checker policy documentation',
      embedding: new Array(1024).fill(0.1),
    });

    const results = await service.hybridSearch(
      'tenant-1',
      'policy',
      new Array(1024).fill(0.1),
      5,
    );
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('c1');
    expect(results[0].text).toContain('Maker-Checker');
  });
});
