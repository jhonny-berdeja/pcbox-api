import { Module } from '@nestjs/common';
import { PcboxController } from './pcbox.controller';
import { PcboxService } from './pcbox.service';
import { AnsibleModule } from '../ansible/ansible.module';
import { AdminApiKeyGuard } from './guards/admin-api-key.guard';

/**
 * `AdministrationsRepository` comes from the `@Global()` `DatabaseModule`,
 * `ConfigService` from the `@Global()` `EnvModule`, and `Logger` from the
 * `@Global()` `LoggerModule` — same reasoning as ticket-hub-api's
 * `TicketsModule`, none of them need to be imported here.
 *
 * `AnsibleModule` DOES need to be imported: it's an ordinary (non-global)
 * feature module owning one external integration (the `ansible-playbook`
 * child process) — split out so it can be read/tested independent of
 * `pcbox`'s own HTTP contract. One-directional dependency (`pcbox` →
 * `ansible`, never the reverse) — see its own module comment.
 *
 * There is no verification against ticket-hub-api anymore — `pcbox` used
 * to import a `ticket-hub-api/` module for that (see git history if you
 * need it), removed once that check stopped being a requirement.
 *
 * `AdminApiKeyGuard` is listed as a provider even though it's applied via
 * `@UseGuards()` at the controller level, not `APP_GUARD`: Nest's DI still
 * needs it registered somewhere to resolve its own `ConfigService`
 * dependency when instantiating it, same reason ticket-hub-api's
 * `TicketsModule` lists `InternalApiKeyGuard`.
 */
@Module({
  imports: [AnsibleModule],
  controllers: [PcboxController],
  providers: [PcboxService, AdminApiKeyGuard],
})
export class PcboxModule {}
