import { KubernetesRegisterEntity } from '../../common/database/administration/kubernetes-register.entity';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';
import { KubernetesResponse } from './dto/kubernetes-response.dto';
import type { K8sApplyResult } from './kubernetes.connector';

export class KubernetesMapper {
  static toEntity(
    dto: CreateKubernetesDto,
    fileContent: string,
  ): KubernetesRegisterEntity {
    return KubernetesRegisterEntity.builder()
      .withTicketNumber(dto.ticketNumber)
      .withDepartment(dto.department)
      .withApprover(dto.approver)
      .withInformer(dto.informer)
      .withStatus(dto.status)
      .withFileContent(fileContent)
      .build();
  }

  /**
   * `exitCode` is always `null` — there's no process exit code concept for
   * the k8s API, unlike the Ansible/SSH path. `stdout` lists every applied
   * resource one per line (including whatever applied before a partial
   * failure); `stderr` carries `result.errorMessage` only when
   * `result.success` is `false`.
   */
  static toResponse(
    execution: KubernetesRegisterEntity,
    result: K8sApplyResult,
  ): KubernetesResponse {
    return {
      id: execution.id,
      ticketNumber: execution.ticketNumber,
      department: execution.department,
      approver: execution.approver,
      informer: execution.informer,
      status: execution.status,
      fileContent: execution.fileContent,
      response: execution.response,
      execution: {
        success: result.success,
        exitCode: null,
        stdout: result.applied
          .map(
            (outcome) =>
              `${outcome.kind}/${outcome.name} in ${outcome.namespace}: ${outcome.action}`,
          )
          .join('\n'),
        stderr: result.success ? '' : (result.errorMessage ?? ''),
      },
    };
  }
}
