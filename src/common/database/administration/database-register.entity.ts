import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * DATABASE-flavored administration/execution record, split out of the old
 * shared `administrations` table (see `pcbox-db.md` for the migration).
 * Written by `database`'s `DatabaseService.executeAdministrationPlaybook`
 * for the SQL-templated playbook produced by `SqlPlaybookBuilder`.
 *
 * `namespace`/`deployment` are intentionally NOT persisted here — they are
 * only needed transiently, as caller-supplied input to
 * `DbTargetValidator.assertAllowed`/`SqlPlaybookBuilder.build` at request
 * time (see `CreateDatabaseAdministrationDto`, which still carries them).
 * `database` (the target `dbName`) is the only target identifier kept.
 */
@Entity({ name: 'database_register' })
export class DatabaseRegisterEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'ticket_number', type: 'int' })
  ticketNumber!: number;

  @Column({ length: 15 })
  department!: string;

  @Column({ length: 100 })
  approver!: string;

  @Column({ length: 30 })
  informer!: string;

  @Column({ length: 30 })
  database!: string;

  @Column({ length: 15 })
  status!: string;

  @Column({ name: 'sql_content', type: 'text' })
  sqlContent!: string;

  /** Only filled in after execution — `null` at insert time. */
  @Column({ type: 'text', nullable: true })
  response!: string | null;

  static builder(): DatabaseRegisterEntityBuilder {
    return new DatabaseRegisterEntityBuilder();
  }
}

export class DatabaseRegisterEntityBuilder {
  private ticketNumber?: number;
  private department?: string;
  private approver?: string;
  private informer?: string;
  private database?: string;
  private status?: string;
  private sqlContent?: string;
  private response: string | null = null;

  withTicketNumber(ticketNumber: number): this {
    this.ticketNumber = ticketNumber;
    return this;
  }

  withDepartment(department: string): this {
    this.department = department;
    return this;
  }

  withApprover(approver: string): this {
    this.approver = approver;
    return this;
  }

  withInformer(informer: string): this {
    this.informer = informer;
    return this;
  }

  withDatabase(database: string): this {
    this.database = database;
    return this;
  }

  withStatus(status: string): this {
    this.status = status;
    return this;
  }

  withSqlContent(sqlContent: string): this {
    this.sqlContent = sqlContent;
    return this;
  }

  withResponse(response: string | null): this {
    this.response = response;
    return this;
  }

  build(): DatabaseRegisterEntity {
    if (this.ticketNumber === undefined) {
      throw new Error(
        'DatabaseRegisterEntity.Builder: ticketNumber is required',
      );
    }
    if (this.department === undefined) {
      throw new Error(
        'DatabaseRegisterEntity.Builder: department is required',
      );
    }
    if (this.approver === undefined) {
      throw new Error('DatabaseRegisterEntity.Builder: approver is required');
    }
    if (this.informer === undefined) {
      throw new Error('DatabaseRegisterEntity.Builder: informer is required');
    }
    if (this.database === undefined) {
      throw new Error('DatabaseRegisterEntity.Builder: database is required');
    }
    if (this.status === undefined) {
      throw new Error('DatabaseRegisterEntity.Builder: status is required');
    }
    if (this.sqlContent === undefined) {
      throw new Error(
        'DatabaseRegisterEntity.Builder: sqlContent is required',
      );
    }

    const entity = new DatabaseRegisterEntity();
    entity.ticketNumber = this.ticketNumber;
    entity.department = this.department;
    entity.approver = this.approver;
    entity.informer = this.informer;
    entity.database = this.database;
    entity.status = this.status;
    entity.sqlContent = this.sqlContent;
    entity.response = this.response;
    return entity;
  }
}
