import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'administrations' })
export class AdministrationEntity {
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

  @Column({ name: 'file_content', type: 'varchar', length: 500 })
  fileContent!: string;

  static builder(): AdministrationEntityBuilder {
    return new AdministrationEntityBuilder();
  }
}

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
