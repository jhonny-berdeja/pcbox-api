import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Maps the `administrations` table (see
 * documentation/pcbox.pcbox-db-deploy.md for the init schema). Every
 * column is `NOT NULL` — unlike `TicketEntity.assignee` in ticket-hub-api,
 * nothing here is optional: an administration record is only ever written
 * after every field has already been validated (local status check, YAML
 * parseability), so there's never a partial row to represent.
 */
@Entity({ name: 'administrations' })
export class AdministrationEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'ticket_number', type: 'int' })
  ticketNumber!: number;

  @Column({ length: 15 })
  department!: string;

  @Column({ length: 15 })
  approver!: string;

  @Column({ length: 15 })
  informer!: string;

  @Column({ length: 15 })
  status!: string;

  // The YAML playbook's raw text, not the temp file written to disk to run
  // it — mirrors ticket-hub-api's TicketEntity.codeAnsible column, just
  // NOT NULL here instead of nullable (an administration always carries a
  // playbook, a ticket doesn't always carry one yet).
  @Column({ name: 'file_content', type: 'varchar', length: 500 })
  fileContent!: string;

  static builder(): AdministrationEntityBuilder {
    return new AdministrationEntityBuilder();
  }
}

/** Fluent builder for `AdministrationEntity` — mirrors `TicketEntityBuilder`'s pattern, but every field is mandatory (no optional defaults). */
export class AdministrationEntityBuilder {
  private ticketNumber?: number;
  private department?: string;
  private approver?: string;
  private informer?: string;
  private status?: string;
  private fileContent?: string;

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

  withStatus(status: string): this {
    this.status = status;
    return this;
  }

  withFileContent(fileContent: string): this {
    this.fileContent = fileContent;
    return this;
  }

  build(): AdministrationEntity {
    if (this.ticketNumber === undefined) {
      throw new Error('AdministrationEntity.Builder: ticketNumber is required');
    }
    if (this.department === undefined) {
      throw new Error('AdministrationEntity.Builder: department is required');
    }
    if (this.approver === undefined) {
      throw new Error('AdministrationEntity.Builder: approver is required');
    }
    if (this.informer === undefined) {
      throw new Error('AdministrationEntity.Builder: informer is required');
    }
    if (this.status === undefined) {
      throw new Error('AdministrationEntity.Builder: status is required');
    }
    if (this.fileContent === undefined) {
      throw new Error('AdministrationEntity.Builder: fileContent is required');
    }

    const entity = new AdministrationEntity();
    entity.ticketNumber = this.ticketNumber;
    entity.department = this.department;
    entity.approver = this.approver;
    entity.informer = this.informer;
    entity.status = this.status;
    entity.fileContent = this.fileContent;
    return entity;
  }
}
