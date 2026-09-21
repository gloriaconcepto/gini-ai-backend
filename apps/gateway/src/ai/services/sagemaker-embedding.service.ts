import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';

@Injectable()
export class SageMakerEmbeddingService implements IEmbeddingProvider {
  private readonly logger = new Logger(SageMakerEmbeddingService.name);
  private readonly client: SageMakerRuntimeClient;
  private readonly endpointName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.endpointName = this.configService.get<string>(
      'SAGEMAKER_EMBEDDING_ENDPOINT_NAME',
      'gini-embeddings-dev',
    );
    this.client = new SageMakerRuntimeClient({ region });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const payload = { inputs: text };

    const command = new InvokeEndpointCommand({
      EndpointName: this.endpointName,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: Buffer.from(JSON.stringify(payload)),
    });

    try {
      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error('Empty response body received from SageMaker embedding endpoint');
      }

      const raw = Buffer.from(response.Body).toString('utf-8');
      const parsed = JSON.parse(raw);

      // Hugging Face TEI returns either [0.1, 0.2, ...] or [[0.1, 0.2, ...]]
      if (Array.isArray(parsed)) {
        if (Array.isArray(parsed[0])) {
          return parsed[0];
        }
        return parsed;
      }
      if (parsed.embedding && Array.isArray(parsed.embedding)) {
        return parsed.embedding;
      }

      throw new Error(`Unexpected embedding format received: ${raw.slice(0, 100)}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to generate embedding from SageMaker endpoint "${this.endpointName}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const payload = { inputs: texts };

    const command = new InvokeEndpointCommand({
      EndpointName: this.endpointName,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: Buffer.from(JSON.stringify(payload)),
    });

    try {
      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error('Empty response body received from SageMaker embedding endpoint');
      }

      const raw = Buffer.from(response.Body).toString('utf-8');
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      throw new Error(`Unexpected batch embedding format received: ${raw.slice(0, 100)}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to generate batch embeddings from SageMaker endpoint "${this.endpointName}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
