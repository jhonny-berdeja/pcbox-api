import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const TICKET_DOES_NOT_MATCH_MESSAGE =
  'Ticket does not match the given criteria';
const VERIFY_REQUEST_TIMEOUT_MS = 5_000;

/**
 * Own, narrow input shape instead of importing `PcboxModule`'s
 * `CreatePcboxDto`: this module talks to ticket-hub-api and shouldn't need
 * to know anything about `pcbox`'s specific HTTP contract, only the five
 * fields ticket-hub-api's own `GET /tickets/:number/verify` actually
 * checks. `PcboxService` passes its `CreatePcboxDto` straight through —
 * TS structural typing means it satisfies this shape without either
 * module importing the other.
 */
export interface TicketVerificationCriteria {
  ticketNumber: number;
  department: string;
  status: string;
  informer: string;
  approver: string;
}

/**
 * Calls ticket-hub-api's machine-to-machine `GET /tickets/:number/verify`
 * (see ticket-hub-api/src/modules/tickets/tickets.controller.ts#verify) —
 * plain Node 22 `fetch`, no `axios`/`@nestjs/axios` dependency added just
 * for one GET call.
 *
 * Split into its own module (`TicketHubApiModule`) so this outbound
 * integration — its own timeout/error handling, its own env vars — can be
 * read/tested/reused independent of `PcboxModule`'s HTTP contract.
 *
 * Any non-200 response (404 no match, 401 bad shared key, network error,
 * timeout) is treated identically: the caller only needs to know
 * "verified" or "not verified", never why — same "reveal the minimum"
 * reasoning ticket-hub-api's own VerifyTicketService documents for its
 * side of this same call.
 */
@Injectable()
export class TicketHubVerificationService {
  constructor(private readonly configService: ConfigService) {}

  async verify(criteria: TicketVerificationCriteria): Promise<void> {
    const url = this.buildVerifyUrl(criteria);
    const internalApiKey = this.configService.get<string>(
      'TICKET_HUB_API_INTERNAL_KEY',
    )!;

    let response: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        VERIFY_REQUEST_TIMEOUT_MS,
      );
      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { 'x-internal-api-key': internalApiKey },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      // Network error, DNS failure, or the abort from the timeout above —
      // all collapse into the same rejection, nothing internal leaks out.
      throw new UnprocessableEntityException(TICKET_DOES_NOT_MATCH_MESSAGE);
    }

    if (response.status !== 200) {
      throw new UnprocessableEntityException(TICKET_DOES_NOT_MATCH_MESSAGE);
    }
  }

  private buildVerifyUrl(criteria: TicketVerificationCriteria): string {
    const baseUrl = this.configService.get<string>('TICKET_HUB_API_URL')!;
    const query = new URLSearchParams({
      department: criteria.department,
      status: criteria.status,
      informer: criteria.informer,
      approver: criteria.approver,
    });
    return `${baseUrl}/tickets/${criteria.ticketNumber}/verify?${query.toString()}`;
  }
}
