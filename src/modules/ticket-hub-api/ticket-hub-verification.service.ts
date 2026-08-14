import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { TicketHubApiConnector } from './ticket-hub-api.connector';

const TICKET_DOES_NOT_MATCH_MESSAGE =
  'Ticket does not match the given criteria';

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
 * Owns the *decisions* around verifying a ticket against ticket-hub-api's
 * machine-to-machine `GET /tickets/:number/verify` (see
 * ticket-hub-api/src/modules/tickets/tickets.controller.ts#verify): which
 * path/query to build, and what any non-200 response means —
 * `TicketHubApiConnector` owns only the mechanics of actually making the
 * HTTP call (see its own comment).
 *
 * Any failure (404 no match, 401 bad shared key, network error, timeout)
 * is treated identically: the caller only needs to know "verified" or
 * "not verified", never why — same "reveal the minimum" reasoning
 * ticket-hub-api's own VerifyTicketService documents for its side of this
 * same call.
 */
@Injectable()
export class TicketHubVerificationService {
  constructor(private readonly ticketHubApiConnector: TicketHubApiConnector) {}

  async verify(criteria: TicketVerificationCriteria): Promise<void> {
    const path = this.buildVerifyPath(criteria);

    let response: Response;
    try {
      response = await this.ticketHubApiConnector.get(path);
    } catch {
      // Network error, DNS failure, or the connector's own timeout abort —
      // all collapse into the same rejection, nothing internal leaks out.
      throw new UnprocessableEntityException(TICKET_DOES_NOT_MATCH_MESSAGE);
    }

    if (response.status !== 200) {
      throw new UnprocessableEntityException(TICKET_DOES_NOT_MATCH_MESSAGE);
    }
  }

  private buildVerifyPath(criteria: TicketVerificationCriteria): string {
    const query = new URLSearchParams({
      department: criteria.department,
      status: criteria.status,
      informer: criteria.informer,
      approver: criteria.approver,
    });
    return `/tickets/${criteria.ticketNumber}/verify?${query.toString()}`;
  }
}
