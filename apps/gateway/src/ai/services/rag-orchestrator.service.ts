import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  LLM_PROVIDER_TOKEN,
} from '../interfaces/llm-provider.interface';
import type { ILlmProvider } from '../interfaces/llm-provider.interface';
import {
  EMBEDDING_PROVIDER_TOKEN,
} from '../interfaces/embedding-provider.interface';
import type { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import {
  VECTOR_STORE_TOKEN,
  VectorChunk,
} from '../interfaces/vector-store.interface';
import type { IVectorStore } from '../interfaces/vector-store.interface';
import { RagQueryDto, IndexChunkDto } from '../dto/ai-requests.dto';
import { RagQueryResponseDto } from '../dto/ai-responses.dto';

@Injectable()
export class RagOrchestratorService {
  private readonly logger = new Logger(RagOrchestratorService.name);

  constructor(
    @Inject(LLM_PROVIDER_TOKEN)
    private readonly llmProvider: ILlmProvider,
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embeddingProvider: IEmbeddingProvider,
    @Inject(VECTOR_STORE_TOKEN)
    private readonly vectorStore: IVectorStore,
  ) {}

  async queryRag(tenantId: string, queryDto: RagQueryDto): Promise<RagQueryResponseDto> {
    const { query, topK = 5, useHybridSearch = true } = queryDto;
    this.logger.log(`Executing RAG query for tenant "${tenantId}": "${query}" (topK=${topK})`);

    // 1. Generate query embedding vector
    const queryVector = await this.embeddingProvider.generateEmbedding(query);

    // 2. Retrieve relevant knowledge chunks from vector store
    const sources = useHybridSearch
      ? await this.vectorStore.hybridSearch(tenantId, query, queryVector, topK)
      : await this.vectorStore.similaritySearch(tenantId, queryVector, topK);

    // 3. Assemble grounded prompt with retrieved knowledge context
    const contextPassages = sources
      .map((s, i) => `[Source ${i + 1} - ID: ${s.chunkId}]\n${s.text}`)
      .join('\n\n');

    const prompt = `You are Gini Enterprise Intelligence, a secure knowledge assistant.
Answer the following user question grounded strictly and truthfully in the provided enterprise context.
If the answer cannot be determined from the context, state that clearly without speculating.

--- ENTERPRISE CONTEXT ---
${contextPassages || 'No context passages found.'}
--------------------------

User Question: ${query}

Grounded Answer:`;

    // 4. Generate answer using LLM
    const answer = await this.llmProvider.generateText(prompt, {
      maxTokens: 1024,
      temperature: 0.2, // Lower temperature for grounded factual generation
    });

    return {
      answer,
      sources,
      retrievalMode: useHybridSearch ? 'hybrid (k-NN + BM25)' : 'dense-vector (k-NN)',
    };
  }

  async indexChunks(tenantId: string, chunksDto: IndexChunkDto[]): Promise<{ indexed: number }> {
    this.logger.log(`Indexing ${chunksDto.length} chunks for tenant "${tenantId}"`);

    // Generate embeddings in batch
    const texts = chunksDto.map((c) => c.text);
    const embeddings = await this.embeddingProvider.generateBatchEmbeddings(texts);

    const chunks: VectorChunk[] = chunksDto.map((c, i) => ({
      chunkId: c.chunkId,
      documentId: c.documentId,
      text: c.text,
      embedding: embeddings[i],
      metadata: c.metadata,
    }));

    await this.vectorStore.bulkIndexChunks(tenantId, chunks);
    return { indexed: chunks.length };
  }
}
