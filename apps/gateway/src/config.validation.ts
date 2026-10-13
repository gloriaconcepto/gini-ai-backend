import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsOptional()
  KEYCLOAK_URL?: string;

  @IsString()
  @IsOptional()
  KEYCLOAK_ADMIN?: string;

  @IsString()
  @IsOptional()
  KEYCLOAK_ADMIN_PASSWORD?: string;

  @IsString()
  @IsOptional()
  KEYCLOAK_ADMIN_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  KEYCLOAK_ADMIN_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  KEYCLOAK_ADMIN_SECRET?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsString()
  @IsOptional()
  ALLOWED_ORIGINS?: string;

  @IsString()
  @IsOptional()
  OEM_BACKOFFICE_URL?: string;

  @IsString()
  @IsOptional()
  ENTERPRISE_PORTAL_URL?: string;

  @IsString()
  @IsOptional()
  AWS_REGION?: string;

  @IsString()
  @IsOptional()
  SAGEMAKER_LLM_ENDPOINT_NAME?: string;

  @IsString()
  @IsOptional()
  SAGEMAKER_EMBEDDING_ENDPOINT_NAME?: string;

  @IsString()
  @IsOptional()
  OPENSEARCH_NODE_URL?: string;

  @IsNumber()
  @IsOptional()
  OPENSEARCH_VECTOR_DIMENSION?: number;

  @IsString()
  @IsOptional()
  AWS_S3_BUCKET_NAME: string = 'gini-rag-documents';

  @IsString()
  @IsOptional()
  AWS_S3_REGION: string = 'us-west-2';

  @IsNumber()
  @IsOptional()
  AWS_S3_PRESIGNED_EXPIRATION_SECONDS: number = 900;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

export const validateConfig = validate;
