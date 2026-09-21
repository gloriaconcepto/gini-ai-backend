import { Module, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LLM_PROVIDER_TOKEN } from './interfaces/llm-provider.interface';
import { EMBEDDING_PROVIDER_TOKEN } from './interfaces/embedding-provider.interface';
import { VECTOR_STORE_TOKEN } from './interfaces/vector-store.interface';
import { SageMakerLlmService } from './services/sagemaker-llm.service';
import { SageMakerEmbeddingService } from './services/sagemaker-embedding.service';
import { OpenSearchVectorService } from './services/opensearch-vector.service';
import { MockLlmService } from './services/mock-llm.service';
import { RagOrchestratorService } from './services/rag-orchestrator.service';
import { AiController } from './controllers/ai.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AiController],
  providers: [
    MockLlmService,
    SageMakerLlmService,
    SageMakerEmbeddingService,
    OpenSearchVectorService,
    {
      provide: LLM_PROVIDER_TOKEN,
      useFactory: (
        config: ConfigService,
        sagemaker: SageMakerLlmService,
        mock: MockLlmService,
      ) => {
        const useAws =
          config.get<string>('NODE_ENV') === 'production' ||
          config.get<string>('APP_ENV') === 'remote';
        return useAws ? sagemaker : mock;
      },
      inject: [ConfigService, SageMakerLlmService, MockLlmService],
    },
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useFactory: (
        config: ConfigService,
        sagemaker: SageMakerEmbeddingService,
        mock: MockLlmService,
      ) => {
        const useAws =
          config.get<string>('NODE_ENV') === 'production' ||
          config.get<string>('APP_ENV') === 'remote';
        return useAws ? sagemaker : mock;
      },
      inject: [ConfigService, SageMakerEmbeddingService, MockLlmService],
    },
    {
      provide: VECTOR_STORE_TOKEN,
      useFactory: (
        config: ConfigService,
        opensearch: OpenSearchVectorService,
        mock: MockLlmService,
      ) => {
        const useAws =
          config.get<string>('NODE_ENV') === 'production' ||
          config.get<string>('APP_ENV') === 'remote';
        return useAws ? opensearch : mock;
      },
      inject: [ConfigService, OpenSearchVectorService, MockLlmService],
    },
    RagOrchestratorService,
  ],
  exports: [
    LLM_PROVIDER_TOKEN,
    EMBEDDING_PROVIDER_TOKEN,
    VECTOR_STORE_TOKEN,
    RagOrchestratorService,
  ],
})
export class AiModule {}
