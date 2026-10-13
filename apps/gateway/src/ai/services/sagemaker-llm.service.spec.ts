import { ConfigService } from '@nestjs/config';
import { SageMakerRuntimeClient } from '@aws-sdk/client-sagemaker-runtime';
import { SageMakerLlmService } from './sagemaker-llm.service';

describe('SageMakerLlmService', () => {
  let service: SageMakerLlmService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let sendMock: jest.SpyInstance;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'SAGEMAKER_LLM_ENDPOINT_NAME') return 'test-llm-endpoint';
        return defaultVal;
      }),
    } as any;

    service = new SageMakerLlmService(mockConfigService);
    sendMock = jest.spyOn(SageMakerRuntimeClient.prototype, 'send');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should invoke endpoint and return parsed generated text', async () => {
    const responsePayload = JSON.stringify([{ generated_text: 'Generated enterprise answer' }]);
    sendMock.mockResolvedValueOnce({
      Body: Buffer.from(responsePayload),
    });

    const result = await service.generateText('What is maker checker?');
    expect(result).toBe('Generated enterprise answer');
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('should handle single object generated_text response', async () => {
    const responsePayload = JSON.stringify({ generated_text: 'Single object text' });
    sendMock.mockResolvedValueOnce({
      Body: Buffer.from(responsePayload),
    });

    const result = await service.generateText('Prompt');
    expect(result).toBe('Single object text');
  });

  it('should throw error when client.send fails', async () => {
    sendMock.mockRejectedValueOnce(new Error('SageMaker error'));
    await expect(service.generateText('Prompt')).rejects.toThrow('SageMaker error');
  });
});
