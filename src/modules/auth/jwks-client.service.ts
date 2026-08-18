import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, type KeyObject } from 'crypto';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

interface Jwk {
  kid: string;
  [key: string]: unknown;
}

interface JwksResponse {
  keys: Jwk[];
}

/**
 * Fetches auth-api's JWKS (`GET /.well-known/jwks.json`) on startup and
 * every 5 minutes after, caching each key by `kid` in memory --
 * `JwtAuthGuard` looks up the key matching a token's own `kid` header
 * here instead of trusting one hardcoded key, so a future key rotation
 * on auth-api's side is picked up within one refresh cycle, no restart
 * needed here. Mirrors ticket-hub-api's own `JwksClientService` exactly.
 *
 * A failed refresh (auth-api unreachable) leaves the previous cache
 * untouched rather than clearing it -- a transient outage shouldn't
 * lock the one guarded route out until the next successful poll.
 */
@Injectable()
export class JwksClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JwksClientService.name);
  private readonly keysByKid = new Map<string, KeyObject>();
  private intervalHandle?: NodeJS.Timeout;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
    this.intervalHandle = setInterval(() => {
      void this.refresh();
    }, REFRESH_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
  }

  getKey(kid: string): KeyObject | undefined {
    return this.keysByKid.get(kid);
  }

  private async refresh(): Promise<void> {
    const authApiUrl = this.configService.get<string>('AUTH_API_URL');
    if (!authApiUrl) {
      this.logger.error('Cannot refresh JWKS: AUTH_API_URL is not configured');
      return;
    }

    const jwks = await this.fetchJwks(authApiUrl);
    if (!jwks) {
      return;
    }

    this.keysByKid.clear();
    for (const jwk of jwks.keys) {
      this.keysByKid.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }));
    }
  }

  private async fetchJwks(authApiUrl: string): Promise<JwksResponse | null> {
    try {
      const response = await fetch(`${authApiUrl}/.well-known/jwks.json`, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.error(
          `Failed to fetch JWKS: auth-api responded ${response.status}`,
        );
        return null;
      }
      return (await response.json()) as JwksResponse;
    } catch (error) {
      this.logger.error('Failed to reach auth-api for JWKS', error);
      return null;
    }
  }
}
