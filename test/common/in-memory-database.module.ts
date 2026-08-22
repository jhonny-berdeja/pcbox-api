import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatacenterRegisterEntity } from '../../src/common/database/administration/datacenter-register.entity';
import { DatabaseRegisterEntity } from '../../src/common/database/administration/database-register.entity';
import { KubernetesRegisterEntity } from '../../src/common/database/administration/kubernetes-register.entity';
import { DatacenterRegisterRepository } from '../../src/common/database/administration/datacenter-register.repository';
import { DatabaseRegisterRepository } from '../../src/common/database/administration/database-register.repository';
import { KubernetesRegisterRepository } from '../../src/common/database/administration/kubernetes-register.repository';

/**
 * Real, unmocked `TypeOrmModule` backed by a throwaway in-memory SQLite DB —
 * same shape as `common/database/database.module.ts`, just swapping the
 * Postgres connection for `better-sqlite3 :memory:` so e2e suites need no
 * running database. Same pattern as ticket-hub-api's own
 * `test/common/in-memory-database.module.ts`.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [
        DatacenterRegisterEntity,
        DatabaseRegisterEntity,
        KubernetesRegisterEntity,
      ],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([
      DatacenterRegisterEntity,
      DatabaseRegisterEntity,
      KubernetesRegisterEntity,
    ]),
  ],
  providers: [
    DatacenterRegisterRepository,
    DatabaseRegisterRepository,
    KubernetesRegisterRepository,
  ],
  exports: [
    DatacenterRegisterRepository,
    DatabaseRegisterRepository,
    KubernetesRegisterRepository,
    TypeOrmModule,
  ],
})
export class InMemoryDatabaseModule {}
