import { ConfigService } from '@nestjs/config';
import { OpenSearchVectorService } from './opensearch-vector.service';

describe('OpenSearchVectorService', () => {
  let service: OpenSearchVectorService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockClient: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'OPENSEARCH_NODE_URL') return 'https://localhost:9200';
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'OPENSEARCH_VECTOR_DIMENSION') return 1024;
        return defaultVal;
      }),
    } as any;

    service = new OpenSearchVectorService(mockConfigService);

    mockClient = {
      indices: {
        exists: jest.fn().mockResolvedValue({ body: true }),
        create: jest.fn().mockResolvedValue({ body: { acknowledged: true } }),
      },
      index: jest.fn().mockResolvedValue({ body: { result: 'created' } }),
      bulk: jest.fn().mockResolvedValue({ body: { errors: false, items: [] } }),
      search: jest.fn().mockResolvedValue({
        body: {
          hits: {
            hits: [
              {
                _id: 'c1',
                _score: 0.92,
                _source: {
                  document_id: 'doc-1',
                  chunk_id: 'c1',
                  text: 'Maker-Checker policy rules',
                  metadata: { page: 1 },
                },
              },
            ],
          },
        },
      }),
    };

    (service as any).client = mockClient;
  });

  it('should format sanitized tenant index names', () => {
    expect(service.getTenantIndexName('Tenant_123!')).toBe(
      'tenant-tenant_123--knowledge-base',
    );
  });

  it('should create index if it does not exist', async () => {
    mockClient.indices.exists.mockResolvedValueOnce({ body: false });
    const indexName = await service.ensureIndexExists('tenant-abc');
    expect(indexName).toBe('tenant-tenant-abc-knowledge-base');
    expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
  });

  it('should index a chunk with vector embeddings', async () => {
    await service.indexChunk('tenant-1', {
      chunkId: 'c1',
      documentId: 'doc-1',
      text: 'Sample text',
      embedding: [0.1, 0.2],
    });

    expect(mockClient.index).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'c1',
        refresh: true,
      }),
    );
  });

  it('should perform similarity search', async () => {
    const results = await service.similaritySearch('tenant-1', [0.1, 0.2], 5);
    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('c1');
    expect(results[0].score).toBe(0.92);
  });

  it('should perform hybrid search combining BM25 and k-NN', async () => {
    const results = await service.hybridSearch('tenant-1', 'Maker-Checker', [0.1, 0.2], 5);
    expect(results).toHaveLength(1);
    expect(mockClient.search).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          query: expect.objectContaining({
            bool: expect.any(Object),
          }),
        }),
      }),
    );
  });
});
