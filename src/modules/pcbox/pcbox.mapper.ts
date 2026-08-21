import { DatacenterRegisterEntity } from '../../common/database/administration/datacenter-register.entity';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { PcboxResponse } from './dto/pcbox-response.dto';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';

export class PcboxMapper {
  static toEntity(
    dto: CreatePcboxDto,
    fileContent: string,
  ): DatacenterRegisterEntity {
    return DatacenterRegisterEntity.builder()
      .withTicketNumber(dto.ticketNumber)
      .withDepartment(dto.department)
      .withApprover(dto.approver)
      .withInformer(dto.informer)
      .withStatus(dto.status)
      .withFileContent(fileContent)
      .build();
  }

  static toResponse(
    administration: DatacenterRegisterEntity,
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
