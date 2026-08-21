import { Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './database.service';
import { AnsibleModule } from '../ansible/ansible.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Named `DatabaseAdministrationModule` (not `DatabaseModule`) to avoid
 * colliding with the unrelated global infra module of that exact name at
 * `src/common/database/database.module.ts` (TypeORM connection wiring) —
 * this one is the DB-ticket feature module living at `src/modules/database/`.
 */
@Module({
  imports: [AnsibleModule, AuthModule],
  controllers: [DatabaseController],
  providers: [DatabaseService],
})
export class DatabaseAdministrationModule {}
