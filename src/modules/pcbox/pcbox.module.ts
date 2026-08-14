import { Module } from '@nestjs/common';
import { PcboxController } from './pcbox.controller';
import { PcboxService } from './pcbox.service';
import { TicketHubApiModule } from '../ticket-hub-api/ticket-hub-api.module';
import { AnsibleModule } from '../ansible/ansible.module';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';

/**
 * `AdministrationsRepository` comes from the `@Global()` `DatabaseModule`,
 * `ConfigService` from the `@Global()` `EnvModule`, and `Logger` from the
 * `@Global()` `LoggerModule` — same reasoning as ticket-hub-api's
 * `TicketsModule`, none of them need to be imported here.
 *
 * `TicketHubApiModule`/`AnsibleModule` DO need to be imported: they're
 * ordinary (non-global) feature modules, each owning one external
 * integration (the outbound call to ticket-hub-api, the `ansible-playbook`
 * child process) — split out so each can be read/tested independent of
 * `pcbox`'s own HTTP contract. One-directional dependency (`pcbox` →
 * `ticket-hub-api`/`ansible`, never the reverse) — see each of their own
 * module comments.
 *
 * `AdminApiKeyGuard` is listed as a provider even though it's applied via
 * `@UseGuards()` at the controller level, not `APP_GUARD`: Nest's DI still
 * needs it registered somewhere to resolve its own `ConfigService`
 * dependency when instantiating it, same reason ticket-hub-api's
 * `TicketsModule` lists `InternalApiKeyGuard`.
 */
@Module({
  imports: [TicketHubApiModule, AnsibleModule],
  controllers: [PcboxController],
  providers: [PcboxService, AdminApiKeyGuard],
})
export class PcboxModule {}
