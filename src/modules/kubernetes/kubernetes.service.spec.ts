import { BadRequestException } from '@nestjs/common';
import { KubernetesRegisterRepository } from '../../common/database/administration/kubernetes-register.repository';
import { KubernetesRegisterEntity } from '../../common/database/administration/kubernetes-register.entity';
import type { KubernetesConnector } from './kubernetes.connector';
import { KubernetesService } from './kubernetes.service';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';

/**
 * `KubernetesService` value-imports `KubernetesConnector`, which
 * value-imports the real (ESM-only) `@kubernetes/client-node` package —
 * ts-jest's CJS loader can't parse it. Mocking it here keeps the real
 * package out of Jest's module graph; this spec never actually
 * constructs a `KubernetesConnector` (a fake object is injected instead),
 * so an empty mock is enough.
 */
jest.mock('@kubernetes/client-node', () => ({
  KubeConfig: jest.fn().mockImplementation(() => ({
    loadFromCluster: jest.fn(),
  })),
  KubernetesObjectApi: { makeApiClient: jest.fn() },
  ApiException: class ApiException extends Error {},
  PatchStrategy: { MergePatch: 'application/merge-patch+json' },
}));

const VALID_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: ticket-hub
`;

function buildDto(
  overrides: Partial<CreateKubernetesDto> = {},
): CreateKubernetesDto {
  const dto = new CreateKubernetesDto();
  dto.ticketNumber = 3;
  dto.department = 'Datacenter';
  dto.approver = 'Beto';
  dto.informer = 'ana@example.com';
  dto.status = 'APPROVED';
  dto.fileContent = VALID_MANIFEST;
  return Object.assign(dto, overrides);
}

describe('KubernetesService', () => {
  it('rejects a non-APPROVED status before parsing manifests or touching the repository/connector', async () => {
    const createExecution = jest.fn();
    const applyManifests = jest.fn();
    const repository = {
      createExecution,
    } as unknown as KubernetesRegisterRepository;
    const connector = { applyManifests } as unknown as KubernetesConnector;

    const service = new KubernetesService(repository, connector);

    await expect(
      service.executeManifests(buildDto({ status: 'CREATED' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createExecution).not.toHaveBeenCalled();
    expect(applyManifests).not.toHaveBeenCalled();
  });

  it('rejects unparseable YAML before touching the repository/connector', async () => {
    const createExecution = jest.fn();
    const applyManifests = jest.fn();
    const repository = {
      createExecution,
    } as unknown as KubernetesRegisterRepository;
    const connector = { applyManifests } as unknown as KubernetesConnector;

    const service = new KubernetesService(repository, connector);

    await expect(
      service.executeManifests(buildDto({ fileContent: 'key: [unclosed' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createExecution).not.toHaveBeenCalled();
    expect(applyManifests).not.toHaveBeenCalled();
  });

  it('rejects a manifest targeting a non-allowlisted namespace before saving or applying anything', async () => {
    const createExecution = jest.fn();
    const applyManifests = jest.fn();
    const repository = {
      createExecution,
    } as unknown as KubernetesRegisterRepository;
    const connector = { applyManifests } as unknown as KubernetesConnector;

    const service = new KubernetesService(repository, connector);

    await expect(
      service.executeManifests(
        buildDto({
          fileContent: VALID_MANIFEST.replace(
            'namespace: ticket-hub',
            'namespace: not-allowed',
          ),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createExecution).not.toHaveBeenCalled();
    expect(applyManifests).not.toHaveBeenCalled();
  });

  it('rejects a manifest with a blocked cluster-scoped kind before saving or applying anything', async () => {
    const createExecution = jest.fn();
    const applyManifests = jest.fn();
    const repository = {
      createExecution,
    } as unknown as KubernetesRegisterRepository;
    const connector = { applyManifests } as unknown as KubernetesConnector;

    const service = new KubernetesService(repository, connector);

    await expect(
      service.executeManifests(
        buildDto({
          fileContent: VALID_MANIFEST.replace(
            'kind: Deployment',
            'kind: ClusterRole',
          ),
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createExecution).not.toHaveBeenCalled();
    expect(applyManifests).not.toHaveBeenCalled();
  });

  it('validates every manifest before applying any of them, even when a later manifest is the invalid one', async () => {
    const createExecution = jest.fn();
    const applyManifests = jest.fn();
    const repository = {
      createExecution,
    } as unknown as KubernetesRegisterRepository;
    const connector = { applyManifests } as unknown as KubernetesConnector;

    const service = new KubernetesService(repository, connector);
    const multiDoc = `${VALID_MANIFEST}\n---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: bad\n  namespace: ticket-hub\n`;

    await expect(
      service.executeManifests(buildDto({ fileContent: multiDoc })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createExecution).not.toHaveBeenCalled();
    expect(applyManifests).not.toHaveBeenCalled();
  });

  it('persists fileContent verbatim and applies the parsed manifests through the connector', async () => {
    const dto = buildDto();
    const savedEntity = KubernetesRegisterEntity.builder()
      .withTicketNumber(dto.ticketNumber)
      .withDepartment(dto.department)
      .withApprover(dto.approver)
      .withInformer(dto.informer)
      .withStatus(dto.status)
      .withFileContent(dto.fileContent)
      .build();
    Object.assign(savedEntity, { id: 11 });

    const createExecution = jest.fn().mockResolvedValue(savedEntity);
    const applyManifests = jest.fn().mockResolvedValue({
      success: true,
      applied: [
        {
          kind: 'Deployment',
          namespace: 'ticket-hub',
          name: 'my-app',
          action: 'created',
        },
      ],
      errorMessage: null,
    });

    const repository = {
      createExecution,
    } as unknown as KubernetesRegisterRepository;
    const connector = { applyManifests } as unknown as KubernetesConnector;

    const service = new KubernetesService(repository, connector);
    const response = await service.executeManifests(dto);

    expect(createExecution).toHaveBeenCalledWith(
      expect.objectContaining({ fileContent: dto.fileContent }),
    );
    expect(applyManifests).toHaveBeenCalledWith([
      expect.objectContaining({
        kind: 'Deployment',
        metadata: expect.objectContaining({
          name: 'my-app',
          namespace: 'ticket-hub',
        }) as unknown,
      }),
    ]);
    expect(response.data.execution).toEqual({
      success: true,
      exitCode: null,
      stdout: 'Deployment/my-app in ticket-hub: created',
      stderr: '',
    });
  });
});
