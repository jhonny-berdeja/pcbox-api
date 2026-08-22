import { KubernetesRegisterEntity } from '../../common/database/administration/kubernetes-register.entity';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';
import { KubernetesResponse } from './dto/kubernetes-response.dto';
import type { K8sApplyResult } from './kubernetes.connector';
import type { AnsibleExecutionResult } from '../ansible/ansible.dto';
import { ExecutionType } from './value-objects/execution-type.enum';

export class KubernetesMapper {
  /** Write path for `KubernetesService.executeManifests` — always stamps `ExecutionType.MANIFEST`. */
  static toManifestEntity(
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
      .withExecutionType(ExecutionType.MANIFEST)
      .build();
  }

  /** Write path for `KubernetesService.executeAnsiblePlaybook` — always stamps `ExecutionType.ANSIBLE`. */
  static toAnsibleEntity(
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
      .withExecutionType(ExecutionType.ANSIBLE)
      .build();
  }

  /**
   * `exitCode` is always `null` — there's no process exit code concept for
   * the k8s API, unlike the Ansible/SSH path. `stdout` lists every applied
   * resource one per line (including whatever applied before a partial
   * failure); `stderr` carries `result.errorMessage` only when
   * `result.success` is `false`.
   */
  static toManifestResponse(
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

  /**
   * Unlike `toManifestResponse`, `result` here already carries the real
   * process exit code and raw stdout/stderr of the `ansible-playbook` SSH
   * run (`AnsibleExecutionResult`) — nothing to synthesize, just passed
   * through.
   */
  static toAnsibleResponse(
    execution: KubernetesRegisterEntity,
    result: AnsibleExecutionResult,
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
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      },
    };
  }
}
