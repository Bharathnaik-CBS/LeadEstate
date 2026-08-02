import type { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';

const LOCAL_JWT_SECRET =
  'lead-estate-local-development-jwt-secret-change-me';
const MIN_JWT_SECRET_LENGTH = 32;

export function getJwtSecret(configService: ConfigService) {
  const configuredSecret = configService.get<string>('JWT_SECRET')?.trim();

  if (configuredSecret) {
    validateJwtSecret(configuredSecret);
    return configuredSecret;
  }

  if (isProduction(configService)) {
    throw new Error(
      `JWT_SECRET is required in production and must be at least ${MIN_JWT_SECRET_LENGTH} characters`,
    );
  }

  return LOCAL_JWT_SECRET;
}

export function getJwtExpiresIn(
  configService: ConfigService,
): JwtSignOptions['expiresIn'] {
  return (
    (configService.get<string>(
      'JWT_EXPIRES_IN',
    ) as JwtSignOptions['expiresIn']) ?? '1d'
  );
}

function validateJwtSecret(secret: string) {
  if (secret.length < MIN_JWT_SECRET_LENGTH || secret === LOCAL_JWT_SECRET) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters and cannot use the local development fallback`,
    );
  }
}

function isProduction(configService: ConfigService) {
  return configService.get<string>('NODE_ENV') === 'production';
}
