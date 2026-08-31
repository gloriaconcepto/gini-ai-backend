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

  it('should export validateConfig as an alias of validate', () => {
    expect(validateConfig).toBe(validate);
  });
});
