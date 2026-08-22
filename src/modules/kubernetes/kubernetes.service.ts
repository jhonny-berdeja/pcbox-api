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

const APPROVED_STATUS = 'APPROVED';
const NOT_APPROVED_MESSAGE = `Only administrations with status '${APPROVED_STATUS}' can be executed`;

@Injectable()
export class KubernetesService {
  constructor(
    private readonly kubernetesRegisterRepository: KubernetesRegisterRepository,
    private readonly kubernetesConnector: KubernetesConnector,
  ) {}

  async executeManifests(
    dto: CreateKubernetesDto,
  ): Promise<ResponseBody<KubernetesResponse>> {
    this.assertApprovedStatus(dto.status);

    const manifests = KubernetesManifestValidator.assertValidManifests(
      dto.fileContent,
    );
    this.assertAllManifestsAllowed(manifests);

    const entity = KubernetesMapper.toEntity(dto, dto.fileContent);
    const savedExecution =
      await this.kubernetesRegisterRepository.createExecution(entity);

    const result = await this.kubernetesConnector.applyManifests(manifests);

    return ResponseBody.builder<KubernetesResponse>()
      .withMsg('Execution saved and manifests applied')
      .withData(KubernetesMapper.toResponse(savedExecution, result))
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
   * it starts.
   */
  private assertAllManifestsAllowed(manifests: K8sManifest[]): void {
    manifests.forEach((manifest) => {
      K8sTargetValidator.assertAllowedNamespace(manifest.metadata.namespace);
      K8sTargetValidator.assertAllowedKind(manifest.kind);
    });
  }
}
