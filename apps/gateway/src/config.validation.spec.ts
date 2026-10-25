import 'reflect-metadata';
import {
  validate,
  validateConfig,
  Environment,
  EnvironmentVariables,
} from './config.validation';

describe('Config Validation', () => {
  it('should validate and transform default config correctly', () => {
    const rawConfig = {
      NODE_ENV: 'development',
      PORT: '3000',
    };

    const validated = validate(rawConfig);

    expect(validated).toBeInstanceOf(EnvironmentVariables);
    expect(validated.NODE_ENV).toBe(Environment.Development);
    expect(validated.PORT).toBe(3000);
    expect(validated.AWS_S3_BUCKET_NAME).toBe('gini-rag-documents');
    expect(validated.AWS_S3_REGION).toBe('us-west-2');
    expect(validated.AWS_S3_PRESIGNED_EXPIRATION_SECONDS).toBe(900);
  });

  it('should throw an error when an invalid enum is provided', () => {
    const rawConfig = {
      NODE_ENV: 'invalid_environment',
    };

    expect(() => validate(rawConfig)).toThrow();
  });

  it('should validate optional CORS and portal URLs correctly', () => {
    const rawConfig = {
      CORS_ORIGINS: 'https://app.gini.ai',
      ALLOWED_ORIGINS: 'https://app.gini.ai,https://admin.gini.ai',
      OEM_BACKOFFICE_URL: 'https://admin.gini.ai',
      ENTERPRISE_PORTAL_URL: 'https://app.gini.ai',
    };

    const validated = validate(rawConfig);
    expect(validated.CORS_ORIGINS).toBe('https://app.gini.ai');
    expect(validated.ALLOWED_ORIGINS).toBe(
      'https://app.gini.ai,https://admin.gini.ai',
    );
    expect(validated.OEM_BACKOFFICE_URL).toBe('https://admin.gini.ai');
    expect(validated.ENTERPRISE_PORTAL_URL).toBe('https://app.gini.ai');
  });

  it('should validate DOCUMENT_STORAGE_MODE and AWS credential configs correctly', () => {
    const rawConfig = {
      APP_ENV: 'local',
      DOCUMENT_STORAGE_MODE: 'remote',
      AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE123',
      AWS_SECRET_ACCESS_KEY: 'secret123',
      AWS_SESSION_TOKEN: 'token123',
      AWS_PROFILE: 'gini',
      AWS_S3_ENDPOINT: 'https://s3.custom.com',
      AWS_S3_FORCE_PATH_STYLE: 'true',
      AWS_S3_BUCKET_NAME: 'gini-rag-documents-587546840220',
    };

    const validated = validate(rawConfig);
    expect(validated.APP_ENV).toBe('local');
    expect(validated.DOCUMENT_STORAGE_MODE).toBe('remote');
    expect(validated.AWS_ACCESS_KEY_ID).toBe('AKIAEXAMPLE123');
    expect(validated.AWS_SECRET_ACCESS_KEY).toBe('secret123');
    expect(validated.AWS_SESSION_TOKEN).toBe('token123');
    expect(validated.AWS_PROFILE).toBe('gini');
    expect(validated.AWS_S3_ENDPOINT).toBe('https://s3.custom.com');
    expect(validated.AWS_S3_FORCE_PATH_STYLE).toBe(true);
    expect(validated.AWS_S3_BUCKET_NAME).toBe('gini-rag-documents-587546840220');
  });

  it('should export validateConfig as an alias of validate', () => {
    expect(validateConfig).toBe(validate);
  });
});
