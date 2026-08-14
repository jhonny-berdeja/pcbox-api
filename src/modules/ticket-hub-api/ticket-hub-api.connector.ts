import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Owns the raw HTTP connection to ticket-hub-api: builds the full URL from
 * the configured base + path, attaches the shared-secret header
 * (`x-internal-api-key`), and enforces the timeout — nothing else.
 * `TicketHubVerificationService` (this module's public API) owns
 * everything *around* this: which path/query to call for a given
 * verification, and what a non-200/timeout/network failure actually
 * means. Kept separate so "how we talk to ticket-hub-api" can change (a
 * different auth header, a retry policy) without touching the
 * verification logic, and so tests can mock this one connection-level
 * concern instead of the whole module — same split as
 * `AnsibleConnector`/`AnsibleService`.
 */
@Injectable()
export class TicketHubApiConnector {
  private static readonly REQUEST_TIMEOUT_MS = 5_000;

  constructor(private readonly configService: ConfigService) {}

  async get(path: string): Promise<Response> {
    const baseUrl = this.configService.get<string>('TICKET_HUB_API_URL')!;
    const internalApiKey = this.configService.get<string>(
      'TICKET_HUB_API_INTERNAL_KEY',
    )!;

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      TicketHubApiConnector.REQUEST_TIMEOUT_MS,
    );
    try {
      return await fetch(`${baseUrl}${path}`, {
        method: 'GET',
        headers: { 'x-internal-api-key': internalApiKey },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
