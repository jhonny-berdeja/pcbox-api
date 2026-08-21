import { DatabaseRegisterEntity } from '../../common/database/administration/database-register.entity';
import { CreateDatabaseAdministrationDto } from './dto/create-database-administration.dto';
import { DatabaseResponse } from './dto/database-response.dto';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';

export class DatabaseMapper {
  /**
   * `namespace`/`deployment` are read off `dto` only to validate the target
   * and build the playbook (see `DatabaseService`) — they are never mapped
   * onto the entity. `dto.dbName` maps to the renamed `database` column.
   */
  static toEntity(
    dto: CreateDatabaseAdministrationDto,
    sqlContent: string,
  ): DatabaseRegisterEntity {
    return DatabaseRegisterEntity.builder()
      .withTicketNumber(dto.ticketNumber)
      .withDepartment(dto.department)
      .withApprover(dto.approver)
      .withInformer(dto.informer)
      .withDatabase(dto.dbName)
      .withStatus(dto.status)
      .withSqlContent(sqlContent)
      .build();
  }

  static toResponse(
    administration: DatabaseRegisterEntity,
    execution: AnsibleExecutionResult,
  ): DatabaseResponse {
    return {
      id: administration.id,
      ticketNumber: administration.ticketNumber,
      department: administration.department,
      approver: administration.approver,
      informer: administration.informer,
      database: administration.database,
      status: administration.status,
      sqlContent: administration.sqlContent,
      response: administration.response,
      execution: {
        success: execution.success,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
      },
    };
  }
}
