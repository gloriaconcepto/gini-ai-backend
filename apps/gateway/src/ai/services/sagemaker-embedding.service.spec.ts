import { ConfigService } from '@nestjs/config';
import { SageMakerRuntimeClient } from '@aws-sdk/client-sagemaker-runtime';
import { SageMakerEmbeddingService } from './sagemaker-embedding.service';

describe('SageMakerEmbeddingService', () => {
  let service: SageMakerEmbeddingService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let sendMock: jest.SpyInstance;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'SAGEMAKER_EMBEDDING_ENDPOINT_NAME') return 'test-embed-endpoint';
        return defaultVal;
      }),
    } as any;

    service = new SageMakerEmbeddingService(mockConfigService);
    sendMock = jest.spyOn(SageMakerRuntimeClient.prototype, 'send');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should invoke embedding endpoint and return 1D float array', async () => {
    const mockVector = [0.12, -0.45, 0.78];
    sendMock.mockResolvedValueOnce({
      Body: Buffer.from(JSON.stringify(mockVector)),
    });

    const result = await service.generateEmbedding('enterprise document text');
    expect(result).toEqual(mockVector);
  });

  it('should handle nested 2D array output [ [0.12, ...] ]', async () => {
    const mockVector = [0.12, -0.45, 0.78];
    sendMock.mockResolvedValueOnce({
      Body: Buffer.from(JSON.stringify([mockVector])),
    });

    const result = await service.generateEmbedding('text');
    expect(result).toEqual(mockVector);
  });

  it('should generate batch embeddings', async () => {
    const batchVectors = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    sendMock.mockResolvedValueOnce({
      Body: Buffer.from(JSON.stringify(batchVectors)),
    });

    const result = await service.generateBatchEmbeddings(['text 1', 'text 2']);
    expect(result).toEqual(batchVectors);
  });

  it('should throw error when endpoint fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('Endpoint timeout'));
    await expect(service.generateEmbedding('text')).rejects.toThrow('Endpoint timeout');
  });
});
