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
