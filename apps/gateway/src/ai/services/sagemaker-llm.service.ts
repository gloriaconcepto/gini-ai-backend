import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SageMakerRuntimeClient,
  InvokeEndpointCommand,
  InvokeEndpointWithResponseStreamCommand,
} from '@aws-sdk/client-sagemaker-runtime';
import { Observable } from 'rxjs';
import { ILlmProvider, LlmGenerateOptions } from '../interfaces/llm-provider.interface';

@Injectable()
export class SageMakerLlmService implements ILlmProvider {
  private readonly logger = new Logger(SageMakerLlmService.name);
  private readonly client: SageMakerRuntimeClient;
  private readonly endpointName: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.endpointName = this.configService.get<string>(
      'SAGEMAKER_LLM_ENDPOINT_NAME',
      'gini-llm-reasoning-dev',
    );
    this.client = new SageMakerRuntimeClient({ region });
  }

  async generateText(prompt: string, options?: LlmGenerateOptions): Promise<string> {
    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.7,
        top_p: options?.topP ?? 0.9,
        stop: options?.stopSequences ?? [],
      },
    };

    const command = new InvokeEndpointCommand({
      EndpointName: this.endpointName,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: Buffer.from(JSON.stringify(payload)),
    });

    try {
      const response = await this.client.send(command);
      if (!response.Body) {
        return '';
      }

      const raw = Buffer.from(response.Body).toString('utf-8');
      const parsed = JSON.parse(raw);

      if (typeof parsed === 'string') {
        return parsed;
      }
      if (Array.isArray(parsed) && parsed[0]?.generated_text) {
        return parsed[0].generated_text;
      }
      if (parsed.generated_text) {
        return parsed.generated_text;
      }
      if (parsed.outputs && Array.isArray(parsed.outputs)) {
        return parsed.outputs[0]?.text || parsed.outputs[0] || '';
      }

      return JSON.stringify(parsed);
    } catch (error: any) {
      this.logger.error(
        `Failed to invoke SageMaker LLM endpoint "${this.endpointName}": ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  streamText(prompt: string, options?: LlmGenerateOptions): Observable<string> {
    return new Observable<string>((subscriber) => {
      const payload = {
        inputs: prompt,
        parameters: {
          max_new_tokens: options?.maxTokens ?? 1024,
          temperature: options?.temperature ?? 0.7,
          top_p: options?.topP ?? 0.9,
          stream: true,
        },
      };

      const command = new InvokeEndpointWithResponseStreamCommand({
        EndpointName: this.endpointName,
        ContentType: 'application/json',
        Accept: 'application/json',
        Body: Buffer.from(JSON.stringify(payload)),
      });

      (async () => {
        try {
          const response = await this.client.send(command);
          if (!response.Body) {
            subscriber.complete();
            return;
          }

          for await (const chunk of response.Body) {
            if (chunk.PayloadPart?.Bytes) {
              const textChunk = Buffer.from(chunk.PayloadPart.Bytes).toString('utf-8');
              subscriber.next(textChunk);
            }
          }
          subscriber.complete();
        } catch (err) {
          this.logger.error(
            `Error in SageMaker LLM stream from "${this.endpointName}": ${err}`,
          );
          subscriber.error(err);
        }
      })();
    });
  }
}
