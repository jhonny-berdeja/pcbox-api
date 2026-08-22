import { Module } from '@nestjs/common';
import { KubernetesController } from './kubernetes.controller';
import { KubernetesService } from './kubernetes.service';
import { KubernetesConnector } from './kubernetes.connector';
import { AuthModule } from '../auth/auth.module';
import { AnsibleModule } from '../ansible/ansible.module';

/**
 * `KubernetesRegisterRepository` is not imported here — it's a provider of
 * the global `DatabaseModule` (`src/common/database/database.module.ts`),
 * same as `DatacenterRegisterRepository`/`DatabaseRegisterRepository`.
 * `KubernetesConnector` is this module's own provider and is never
 * exported, same "connector vs. service" split `AnsibleModule` uses.
 *
 * `AnsibleModule` is imported (not re-declared) to get `AnsibleService` for
 * `KubernetesService.executeAnsiblePlaybook` — same module `PcboxModule`
 * imports for the same reason. `AnsibleConnector` stays internal to
 * `AnsibleModule`, never touched from here.
 */
@Module({
  imports: [AuthModule, AnsibleModule],
  controllers: [KubernetesController],
  providers: [KubernetesService, KubernetesConnector],
})
export class KubernetesModule {}
