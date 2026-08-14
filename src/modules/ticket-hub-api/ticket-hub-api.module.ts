import { Module } from '@nestjs/common';
import { TicketHubVerificationService } from './ticket-hub-verification.service';
import { TicketHubApiConnector } from './ticket-hub-api.connector';

/**
 * Owns the outbound integration with ticket-hub-api — split out of
 * `PcboxModule` so this concern (the shared secret, the URL, the timeout)
 * can be read/tested/reused independent of `pcbox`'s own HTTP contract.
 *
 * `TicketHubApiConnector` is a provider but deliberately NOT exported:
 * it's an internal implementation detail (the raw HTTP mechanics), only
 * `TicketHubVerificationService` (this module's public API) talks to it —
 * same encapsulation as `AnsibleConnector`/`AnsibleModule`.
 *
 * `TicketHubVerificationService.verify()` takes its own
 * `TicketVerificationCriteria` shape, not `PcboxModule`'s `CreatePcboxDto`
 * — see that file's own comment for why.
 */
@Module({
  providers: [TicketHubVerificationService, TicketHubApiConnector],
  exports: [TicketHubVerificationService],
})
export class TicketHubApiModule {}
