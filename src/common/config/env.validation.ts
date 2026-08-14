import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsString,
  validateSync,
} from 'class-validator';

/** Valid pino log levels, in ascending severity order. */
const PINO_LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const;

/**
 * Every container env var the app needs, all mandatory. `DATABASE_PORT`/
 * `PORT` are validated as numeric strings since they're `parseInt`'d /
 * passed to `app.listen()` downstream — a non-numeric value should fail
 * here, not there.
 */
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
   * Base URL of ticket-hub-api's `GET /tickets/:number/verify`, e.g.
   * `http://ticket-hub-api.ticket-hub.svc.cluster.local:3000` — in-cluster
   * DNS, never a public address. Not `@IsUrl()`: that validator requires a
   * public-looking TLD and rejects `*.svc.cluster.local` hostnames.
   */
  @IsString()
  @IsNotEmpty()
  TICKET_HUB_API_URL!: string;

  /**
   * Shared secret sent as `x-internal-api-key` when calling ticket-hub-api's
   * verify endpoint — must hold the exact same value as ticket-hub-api's own
   * `INTERNAL_API_KEY`. Provisioned as a separate Secret in this namespace
   * (Kubernetes Secrets don't cross namespaces), see
   * documentation/pcbox.administrations-deploy.md.
   */
  @IsString()
  @IsNotEmpty()
  TICKET_HUB_API_INTERNAL_KEY!: string;

  /** Shared secret this app itself requires via `x-admin-api-key` on POST /pcbox — see AdminApiKeyGuard. */
  @IsString()
  @IsNotEmpty()
  ADMIN_API_KEY!: string;

  /** Host of the real `pcbox` server the app SSHes into to run administration playbooks — same server/value as the human-facing `SSH_HOST` secret documented in pcbox.bootstrap.md, now also consumed by this app. */
  @IsString()
  @IsNotEmpty()
  PCBOX_SSH_HOST!: string;

  /** SSH user the app authenticates as against `pcbox` — same conceptual value as the human-facing `SSH_USER` secret in pcbox.bootstrap.md. */
  @IsString()
  @IsNotEmpty()
  PCBOX_SSH_USER!: string;
}

/**
 * Fail-fast environment validation.
 *
 * The app runs cluster-only: every value below arrives as a container env
 * var injected by the Deployment/Secret, never a `.env` file. Throwing here
 * stops the process at boot instead of silently falling back to defaults
 * like `localhost`.
 */
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
