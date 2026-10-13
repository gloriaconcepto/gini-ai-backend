import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import {
  IVectorStore,
  VectorChunk,
  VectorSearchResult,
} from '../interfaces/vector-store.interface';

@Injectable()
export class OpenSearchVectorService implements IVectorStore {
  private readonly logger = new Logger(OpenSearchVectorService.name);
  private readonly client: Client;
  private readonly dimension: number;

  constructor(private readonly configService: ConfigService) {
    const node = this.configService.get<string>(
      'OPENSEARCH_NODE_URL',
      'https://localhost:9200',
    );
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.dimension = this.configService.get<number>('OPENSEARCH_VECTOR_DIMENSION', 1024);

    // If AWS credentials / cloud mode is active, use SigV4; otherwise use standard client
    const isCloud = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'remote';

    if (isCloud) {
      this.client = new Client({
        ...AwsSigv4Signer({
          region,
          service: 'es',
          getCredentials: () => defaultProvider()(),
        }),
        node,
      });
    } else {
      this.client = new Client({
        node,
        ssl: { rejectUnauthorized: false },
      });
    }
  }

  getTenantIndexName(tenantId: string): string {
    const sanitizedTenant = tenantId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    return `tenant-${sanitizedTenant}-knowledge-base`;
  }

  async ensureIndexExists(tenantId: string): Promise<string> {
    const indexName = this.getTenantIndexName(tenantId);
    const exists = await this.client.indices.exists({ index: indexName });

    if (!exists.body) {
      this.logger.log(`Creating k-NN vector index "${indexName}" for tenant "${tenantId}"`);
      await this.client.indices.create({
        index: indexName,
        body: {
          settings: {
            index: {
              knn: true,
              'knn.algo_param.ef_search': 100,
            },
          },
          mappings: {
            properties: {
              document_id: { type: 'keyword' },
              tenant_id: { type: 'keyword' },
              chunk_id: { type: 'keyword' },
              text: { type: 'text', analyzer: 'standard' },
              embedding: {
                type: 'knn_vector',
                dimension: this.dimension,
                method: {
                  name: 'hnsw',
                  space_type: 'cosinesimil',
                  engine: 'faiss',
                  parameters: {
                    ef_construction: 128,
                    m: 16,
                  },
                },
              },
              metadata: { type: 'object' },
            },
          },
        },
      });
    }

    return indexName;
  }

  async indexChunk(tenantId: string, chunk: VectorChunk): Promise<void> {
    const indexName = await this.ensureIndexExists(tenantId);

    await this.client.index({
      index: indexName,
      id: chunk.chunkId,
      body: {
        document_id: chunk.documentId,
        tenant_id: tenantId,
        chunk_id: chunk.chunkId,
        text: chunk.text,
        embedding: chunk.embedding,
        metadata: chunk.metadata || {},
      },
      refresh: true,
    });
  }

  async bulkIndexChunks(tenantId: string, chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    const indexName = await this.ensureIndexExists(tenantId);

    const body = chunks.flatMap((chunk) => [
      { index: { _index: indexName, _id: chunk.chunkId } },
      {
        document_id: chunk.documentId,
        tenant_id: tenantId,
        chunk_id: chunk.chunkId,
        text: chunk.text,
        embedding: chunk.embedding,
        metadata: chunk.metadata || {},
      },
    ]);

    await this.client.bulk({ body, refresh: true });
  }

  async similaritySearch(
    tenantId: string,
    queryVector: number[],
    topK = 5,
  ): Promise<VectorSearchResult[]> {
    const indexName = this.getTenantIndexName(tenantId);
    const exists = await this.client.indices.exists({ index: indexName });
    if (!exists.body) {
      return [];
    }

    const response = await this.client.search({
      index: indexName,
      body: {
        size: topK,
        query: {
          knn: {
            embedding: {
              vector: queryVector,
              k: topK,
            },
          },
        },
      },
    });

    return (response.body.hits?.hits || []).map((hit: any) => ({
      chunkId: hit._source.chunk_id || hit._id,
      documentId: hit._source.document_id,
      text: hit._source.text,
      score: hit._score,
      metadata: hit._source.metadata,
    }));
  }

  async hybridSearch(
    tenantId: string,
    queryText: string,
    queryVector: number[],
    topK = 5,
  ): Promise<VectorSearchResult[]> {
    const indexName = this.getTenantIndexName(tenantId);
    const exists = await this.client.indices.exists({ index: indexName });
    if (!exists.body) {
      return [];
    }

    // Hybrid combination: BM25 text match + k-NN dense vector match
    const response = await this.client.search({
      index: indexName,
      body: {
        size: topK,
        query: {
          bool: {
            should: [
              {
                match: {
                  text: {
                    query: queryText,
                    boost: 0.4,
                  },
                },
              },
              {
                knn: {
                  embedding: {
                    vector: queryVector,
                    k: topK,
                    boost: 0.6,
                  },
                },
              },
            ],
          },
        },
      },
    });

    return (response.body.hits?.hits || []).map((hit: any) => ({
      chunkId: hit._source.chunk_id || hit._id,
      documentId: hit._source.document_id,
      text: hit._source.text,
      score: hit._score,
      metadata: hit._source.metadata,
    }));
  }
}
