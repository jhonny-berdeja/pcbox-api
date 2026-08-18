import { Module } from '@nestjs/common';
import { PcboxController } from './pcbox.controller';
import { PcboxService } from './pcbox.service';
import { AnsibleModule } from '../ansible/ansible.module';
import { AuthModule } from '../auth/auth.module';

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
 * `AuthModule` provides `JwtAuthGuard`/`RolesGuard`, applied via
 * `@UseGuards()` on `PcboxController` — imported (not just the guards
 * declared here directly) so their own dependency (`JwksClientService`)
 * resolves correctly across the module boundary, same reasoning as
 * ticket-hub-api's own `AuthModule` export comment.
 *
 * There is no verification against ticket-hub-api anymore — `pcbox` used
 * to import a `ticket-hub-api/` module for that (see git history if you
 * need it), removed once that check stopped being a requirement.
 */
@Module({
  imports: [AnsibleModule, AuthModule],
  controllers: [PcboxController],
  providers: [PcboxService],
})
export class PcboxModule {}
