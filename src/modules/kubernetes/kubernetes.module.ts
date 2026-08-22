import { Module } from '@nestjs/common';
import { KubernetesController } from './kubernetes.controller';
import { KubernetesService } from './kubernetes.service';
import { KubernetesConnector } from './kubernetes.connector';
import { AuthModule } from '../auth/auth.module';

/**
 * `KubernetesRegisterRepository` is not imported here — it's a provider of
 * the global `DatabaseModule` (`src/common/database/database.module.ts`),
 * same as `DatacenterRegisterRepository`/`DatabaseRegisterRepository`.
 * `KubernetesConnector` is this module's own provider and is never
 * exported, same "connector vs. service" split `AnsibleModule` uses.
 */
@Module({
  imports: [AuthModule],
  controllers: [KubernetesController],
  providers: [KubernetesService, KubernetesConnector],
})
export class KubernetesModule {}
