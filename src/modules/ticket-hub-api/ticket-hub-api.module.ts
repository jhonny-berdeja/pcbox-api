import { Module } from '@nestjs/common';
import { TicketHubVerificationService } from './ticket-hub-verification.service';

/**
 * Owns the outbound integration with ticket-hub-api — split out of
 * `PcboxModule` so this concern (the shared secret, the URL, the timeout)
 * can be read/tested/reused independent of `pcbox`'s own HTTP contract.
 * `TicketHubVerificationService.verify()` takes its own
 * `TicketVerificationCriteria` shape, not `PcboxModule`'s `CreatePcboxDto`
 * — see that file's own comment for why.
 */
@Module({
  providers: [TicketHubVerificationService],
  exports: [TicketHubVerificationService],
})
export class TicketHubApiModule {}
