import { AdministrationEntity } from '../../common/database/administration/administration.entity';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { PcboxResponse } from './pcbox-response';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';

export class PcboxMapper {
  static toEntity(dto: CreatePcboxDto): AdministrationEntity {
    return AdministrationEntity.builder()
      .withTicketNumber(dto.ticketNumber)
      .withDepartment(dto.department)
      .withApprover(dto.approver)
      .withInformer(dto.informer)
      .withStatus(dto.status)
      .withFileContent(dto.fileContent)
      .build();
  }

  static toResponse(
    administration: AdministrationEntity,
    execution: AnsibleExecutionResult,
  ): PcboxResponse {
    return {
      id: administration.id,
      ticketNumber: administration.ticketNumber,
      department: administration.department,
      approver: administration.approver,
      informer: administration.informer,
      status: administration.status,
      fileContent: administration.fileContent,
      execution: {
        success: execution.success,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
      },
    };
  }
}
