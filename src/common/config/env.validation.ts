import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsString,
  validateSync,
} from 'class-validator';

const PINO_LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const;

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  POSTGRES_USER!: string;

  @IsString()
  @IsNotEmpty()
  POSTGRES_PASSWORD!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST!: string;

  @IsNumberString()
  DATABASE_PORT!: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME!: string;

  @IsNumberString()
  PORT!: string;

  @IsIn(PINO_LOG_LEVELS)
  LOG_LEVEL!: string;

  /**
   * In-cluster base URL of auth-api, e.g.
   * `http://auth-api.auth-api.svc.cluster.local:3000` -- `JwksClientService`
   * polls `${AUTH_API_URL}/.well-known/jwks.json` every 5 minutes to
   * refresh the RS256 key `JwtAuthGuard` verifies every request against.
   * Replaces `ADMIN_API_KEY` (see JwtAuthGuard's history).
   */
  @IsString()
  @IsNotEmpty()
  AUTH_API_URL!: string;

  /** Host of the real `pcbox` server the app SSHes into to run administration playbooks — same server/value as the human-facing `SSH_HOST` secret documented in pcbox.bootstrap.md, now also consumed by this app. */
  @IsString()
  @IsNotEmpty()
  PCBOX_SSH_HOST!: string;

  /** SSH user the app authenticates as against `pcbox` — same conceptual value as the human-facing `SSH_USER` secret in pcbox.bootstrap.md. */
  @IsString()
  @IsNotEmpty()
  PCBOX_SSH_USER!: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const invalid = errors.map((error) => error.property).join(', ');
    throw new Error(`Missing required environment variable(s): ${invalid}`);
  }

  return validatedConfig;
}
