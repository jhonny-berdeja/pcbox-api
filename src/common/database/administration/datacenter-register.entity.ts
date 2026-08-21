import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * ANSIBLE-flavored administration/execution record, split out of the old
 * shared `administrations` table (see `pcbox-db.md` for the migration).
 * Written by `pcbox`'s `PcboxService.executeAdministrationPlaybook` for a
 * hand-authored playbook delivered as-is in `fileContent`.
 */
@Entity({ name: 'datacenter_register' })
export class DatacenterRegisterEntity {
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

  @Column({ length: 15 })
  status!: string;

  @Column({ name: 'file_content', type: 'text' })
  fileContent!: string;

  /** Only filled in after execution — `null` at insert time. */
  @Column({ type: 'text', nullable: true })
  response!: string | null;

  static builder(): DatacenterRegisterEntityBuilder {
    return new DatacenterRegisterEntityBuilder();
  }
}

export class DatacenterRegisterEntityBuilder {
  private ticketNumber?: number;
  private department?: string;
  private approver?: string;
  private informer?: string;
  private status?: string;
  private fileContent?: string;
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

  withStatus(status: string): this {
    this.status = status;
    return this;
  }

  withFileContent(fileContent: string): this {
    this.fileContent = fileContent;
    return this;
  }

  withResponse(response: string | null): this {
    this.response = response;
    return this;
  }

  build(): DatacenterRegisterEntity {
    if (this.ticketNumber === undefined) {
      throw new Error(
        'DatacenterRegisterEntity.Builder: ticketNumber is required',
      );
    }
    if (this.department === undefined) {
      throw new Error(
        'DatacenterRegisterEntity.Builder: department is required',
      );
    }
    if (this.approver === undefined) {
      throw new Error(
        'DatacenterRegisterEntity.Builder: approver is required',
      );
    }
    if (this.informer === undefined) {
      throw new Error(
        'DatacenterRegisterEntity.Builder: informer is required',
      );
    }
    if (this.status === undefined) {
      throw new Error('DatacenterRegisterEntity.Builder: status is required');
    }
    if (this.fileContent === undefined) {
      throw new Error(
        'DatacenterRegisterEntity.Builder: fileContent is required',
      );
    }

    const entity = new DatacenterRegisterEntity();
    entity.ticketNumber = this.ticketNumber;
    entity.department = this.department;
    entity.approver = this.approver;
    entity.informer = this.informer;
    entity.status = this.status;
    entity.fileContent = this.fileContent;
    entity.response = this.response;
    return entity;
  }
}
