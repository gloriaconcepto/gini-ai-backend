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

  it('should export validateConfig as an alias of validate', () => {
    expect(validateConfig).toBe(validate);
  });
});
