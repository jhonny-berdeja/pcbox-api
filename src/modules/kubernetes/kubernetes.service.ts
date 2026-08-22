import { BadRequestException, Injectable } from '@nestjs/common';
import { KubernetesRegisterRepository } from '../../common/database/administration/kubernetes-register.repository';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';
import { KubernetesMapper } from './kubernetes.mapper';
import { KubernetesResponse } from './dto/kubernetes-response.dto';
import { KubernetesConnector } from './kubernetes.connector';
import {
  K8sManifest,
  KubernetesManifestValidator,
} from './kubernetes-manifest.validator';
import { K8sTargetValidator } from './k8s-target.validator';
import { AnsibleService } from '../ansible/ansible.service';
import { AnsibleValidator } from '../ansible/ansible.validator';

const APPROVED_STATUS = 'APPROVED';
const NOT_APPROVED_MESSAGE = `Only administrations with status '${APPROVED_STATUS}' can be executed`;

@Injectable()
export class KubernetesService {
  constructor(
    private readonly kubernetesRegisterRepository: KubernetesRegisterRepository,
    private readonly kubernetesConnector: KubernetesConnector,
    private readonly ansibleService: AnsibleService,
  ) {}

  async executeManifests(
    dto: CreateKubernetesDto,
  ): Promise<ResponseBody<KubernetesResponse>> {
    this.assertApprovedStatus(dto.status);

    const manifests = KubernetesManifestValidator.assertValidManifests(
      dto.fileContent,
    );
    this.assertAllManifestsAllowed(manifests);

    const entity = KubernetesMapper.toManifestEntity(dto, dto.fileContent);
    const savedExecution =
      await this.kubernetesRegisterRepository.createExecution(entity);

    const result = await this.kubernetesConnector.applyManifests(manifests);

    return ResponseBody.builder<KubernetesResponse>()
      .withMsg('Execution saved and manifests applied')
      .withData(KubernetesMapper.toManifestResponse(savedExecution, result))
      .build();
  }

  /**
   * `POST /kubernetes/ansible` — same audit/persist-before-execute pattern
   * as `executeManifests`, but the YAML is an Ansible playbook run by SSH
   * through `AnsibleService`/`AnsibleConnector` (same mechanism
   * `PcboxService.executeAdministrationPlaybook` uses), not a k8s manifest
   * applied via the in-cluster API — so it validates with
   * `AnsibleValidator.assertValidYamlPlaybook` instead of
   * `KubernetesManifestValidator`/`K8sTargetValidator`, and never touches
   * `KubernetesConnector`.
   */
  async executeAnsiblePlaybook(
    dto: CreateKubernetesDto,
  ): Promise<ResponseBody<KubernetesResponse>> {
    this.assertApprovedStatus(dto.status);
    AnsibleValidator.assertValidYamlPlaybook(dto.fileContent);

    const entity = KubernetesMapper.toAnsibleEntity(dto, dto.fileContent);
    const savedExecution =
      await this.kubernetesRegisterRepository.createExecution(entity);

    const result = await this.ansibleService.execute(dto.fileContent);

    return ResponseBody.builder<KubernetesResponse>()
      .withMsg('Execution saved and playbook execution finished')
      .withData(KubernetesMapper.toAnsibleResponse(savedExecution, result))
      .build();
  }

  private assertApprovedStatus(status: string): void {
    if (status !== APPROVED_STATUS) {
      throw new BadRequestException(NOT_APPROVED_MESSAGE);
    }
  }

  /**
   * Validates every manifest's namespace/kind before applying any of
   * them — fail closed before any mutation, unlike
   * `KubernetesConnector.applyManifests`, which can partially succeed once
   * it starts. Only used by `executeManifests` — the Ansible path has no
   * concept of a k8s manifest to check.
   */
  private assertAllManifestsAllowed(manifests: K8sManifest[]): void {
    manifests.forEach((manifest) => {
      K8sTargetValidator.assertAllowedNamespace(manifest.metadata.namespace);
      K8sTargetValidator.assertAllowedKind(manifest.kind);
    });
  }
}
