import {
  Controller,
  Post,
  Body,
  Req,
  Inject,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import {
  GenerateTextDto,
  GenerateEmbeddingDto,
  RagQueryDto,
  IndexChunkDto,
} from '../dto/ai-requests.dto';
import {
  GenerateTextResponseDto,
  GenerateEmbeddingResponseDto,
  RagQueryResponseDto,
} from '../dto/ai-responses.dto';
import {
  LLM_PROVIDER_TOKEN,
} from '../interfaces/llm-provider.interface';
import type { ILlmProvider } from '../interfaces/llm-provider.interface';
import {
  EMBEDDING_PROVIDER_TOKEN,
} from '../interfaces/embedding-provider.interface';
import type { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { RagOrchestratorService } from '../services/rag-orchestrator.service';

@ApiTags('AI & RAG Services')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    @Inject(LLM_PROVIDER_TOKEN)
    private readonly llmProvider: ILlmProvider,
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly ragOrchestrator: RagOrchestratorService,
  ) {}

  private extractTenantId(req: any): string {
    return (
      req.user?.tenantId ||
      req.headers['x-tenant-id'] ||
      'default-tenant'
    );
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate text completion from SageMaker LLM',
    description: 'Generates text directly using the deployed SageMaker Real-Time foundation model.',
  })
  @ApiResponse({
    status: 200,
    description: 'Text generation completed successfully.',
    type: GenerateTextResponseDto,
  })
  async generateText(
    @Body() dto: GenerateTextDto,
  ): Promise<GenerateTextResponseDto> {
    const generatedText = await this.llmProvider.generateText(dto.prompt, {
      maxTokens: dto.maxTokens,
      temperature: dto.temperature,
      topP: dto.topP,
    });

    return {
      generatedText,
      model: process.env.SAGEMAKER_LLM_ENDPOINT_NAME || 'mock-llm-engine',
    };
  }

  @Post('embeddings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate dense vector embeddings',
    description: 'Generates high-dimensional vector representations via the SageMaker embedding endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Embeddings generated successfully.',
    type: GenerateEmbeddingResponseDto,
  })
  async generateEmbeddings(
    @Body() dto: GenerateEmbeddingDto,
  ): Promise<GenerateEmbeddingResponseDto> {
    const embedding = await this.embeddingProvider.generateEmbedding(dto.text);
    return {
      embedding,
      dimension: embedding.length,
    };
  }

  @Post('rag/query')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({
    name: 'X-Tenant-ID',
    description: 'Target tenant identifier for multi-tenant knowledge base isolation',
    required: false,
  })
  @ApiOperation({
    summary: 'Execute grounded RAG query',
    description: 'Retrieves relevant passages from Amazon OpenSearch and generates a grounded response using SageMaker LLM.',
  })
  @ApiResponse({
    status: 200,
    description: 'RAG response generated with source citations.',
    type: RagQueryResponseDto,
  })
  async queryRag(
    @Req() req: any,
    @Body() dto: RagQueryDto,
  ): Promise<RagQueryResponseDto> {
    const tenantId = this.extractTenantId(req);
    return this.ragOrchestrator.queryRag(tenantId, dto);
  }

  @Post('rag/index')
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: 'X-Tenant-ID',
    description: 'Target tenant identifier for multi-tenant knowledge base isolation',
    required: false,
  })
  @ApiOperation({
    summary: 'Index knowledge chunks into OpenSearch vector store',
    description: 'Generates embeddings and indexes document chunks into the tenant-specific OpenSearch index.',
  })
  @ApiResponse({
    status: 201,
    description: 'Chunks indexed successfully.',
  })
  async indexChunks(
    @Req() req: any,
    @Body() chunks: IndexChunkDto[],
  ): Promise<{ indexed: number }> {
    const tenantId = this.extractTenantId(req);
    return this.ragOrchestrator.indexChunks(tenantId, chunks);
  }
}
