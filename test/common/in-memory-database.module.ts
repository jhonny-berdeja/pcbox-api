import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrationEntity } from '../../src/common/database/administration/administration.entity';
import { AdministrationsRepository } from '../../src/common/database/administration/administrations.repository';

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
      entities: [AdministrationEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([AdministrationEntity]),
  ],
  providers: [AdministrationsRepository],
  exports: [AdministrationsRepository, TypeOrmModule],
})
export class InMemoryDatabaseModule {}
