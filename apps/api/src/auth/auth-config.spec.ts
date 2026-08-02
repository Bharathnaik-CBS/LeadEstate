import type { ConfigService } from '@nestjs/config';
import { getJwtExpiresIn, getJwtSecret } from './auth-config';

describe('auth config', () => {
  it('uses a safe local fallback outside production', () => {
    const configService = createConfigService({});

    expect(getJwtSecret(configService)).toBe(
      'lead-estate-local-development-jwt-secret-change-me',
    );
  });

  it('requires an explicit strong JWT secret in production', () => {
    const configService = createConfigService({
      NODE_ENV: 'production',
    });

    expect(() => getJwtSecret(configService)).toThrow(
      'JWT_SECRET is required in production',
    );
  });

  it('rejects weak or local fallback JWT secrets', () => {
    expect(() =>
      getJwtSecret(
        createConfigService({
          JWT_SECRET: 'short-secret',
        }),
      ),
    ).toThrow('JWT_SECRET must be at least');

    expect(() =>
      getJwtSecret(
        createConfigService({
          JWT_SECRET: 'lead-estate-local-development-jwt-secret-change-me',
        }),
      ),
    ).toThrow('local development fallback');
  });

  it('uses configured JWT expiry or the default', () => {
    expect(getJwtExpiresIn(createConfigService({}))).toBe('1d');
    expect(
      getJwtExpiresIn(
        createConfigService({
          JWT_EXPIRES_IN: '2h',
        }),
      ),
    ).toBe('2h');
  });

  function createConfigService(values: Record<string, string>) {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }
});
