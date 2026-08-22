import { BadRequestException } from '@nestjs/common';
import { KubernetesRegisterRepository } from '../../common/database/administration/kubernetes-register.repository';
import { KubernetesRegisterEntity } from '../../common/database/administration/kubernetes-register.entity';
import type { KubernetesConnector } from './kubernetes.connector';
import { KubernetesService } from './kubernetes.service';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';
import type { AnsibleService } from '../ansible/ansible.service';
import { ExecutionType } from './value-objects/execution-type.enum';

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

const VALID_PLAYBOOK = '- hosts: all\n  tasks: []';

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
  describe('executeManifests', () => {
    it('rejects a non-APPROVED status before parsing manifests or touching the repository/connector', async () => {
      const createExecution = jest.fn();
      const applyManifests = jest.fn();
      const repository = {
        createExecution,
      } as unknown as KubernetesRegisterRepository;
      const connector = { applyManifests } as unknown as KubernetesConnector;
      const ansibleService = {
        execute: jest.fn(),
      } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );

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
      const ansibleService = {
        execute: jest.fn(),
      } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );

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
      const ansibleService = {
        execute: jest.fn(),
      } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );

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
      const ansibleService = {
        execute: jest.fn(),
      } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );

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
      const ansibleService = {
        execute: jest.fn(),
      } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );
      const multiDoc = `${VALID_MANIFEST}\n---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: bad\n  namespace: ticket-hub\n`;

      await expect(
        service.executeManifests(buildDto({ fileContent: multiDoc })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createExecution).not.toHaveBeenCalled();
      expect(applyManifests).not.toHaveBeenCalled();
    });

    it('persists fileContent verbatim with executionType MANIFEST and applies the parsed manifests through the connector', async () => {
      const dto = buildDto();
      const savedEntity = KubernetesRegisterEntity.builder()
        .withTicketNumber(dto.ticketNumber)
        .withDepartment(dto.department)
        .withApprover(dto.approver)
        .withInformer(dto.informer)
        .withStatus(dto.status)
        .withFileContent(dto.fileContent)
        .withExecutionType(ExecutionType.MANIFEST)
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
      const ansibleService = {
        execute: jest.fn(),
      } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );
      const response = await service.executeManifests(dto);

      expect(createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          fileContent: dto.fileContent,
          executionType: ExecutionType.MANIFEST,
        }),
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

  describe('executeAnsiblePlaybook', () => {
    it('rejects a non-APPROVED status before validating the YAML or touching the repository/AnsibleService', async () => {
      const createExecution = jest.fn();
      const execute = jest.fn();
      const repository = {
        createExecution,
      } as unknown as KubernetesRegisterRepository;
      const connector = {} as unknown as KubernetesConnector;
      const ansibleService = { execute } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );

      await expect(
        service.executeAnsiblePlaybook(
          buildDto({ status: 'CREATED', fileContent: VALID_PLAYBOOK }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createExecution).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });

    it('rejects unparseable YAML before touching the repository/AnsibleService', async () => {
      const createExecution = jest.fn();
      const execute = jest.fn();
      const repository = {
        createExecution,
      } as unknown as KubernetesRegisterRepository;
      const connector = {} as unknown as KubernetesConnector;
      const ansibleService = { execute } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );

      await expect(
        service.executeAnsiblePlaybook(
          buildDto({ fileContent: 'key: [unclosed' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(createExecution).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
    });

    it('never validates the YAML as a k8s manifest (no namespace/kind allowlist checks apply here)', async () => {
      const savedEntity = Object.assign(
        KubernetesRegisterEntity.builder()
          .withTicketNumber(3)
          .withDepartment('Datacenter')
          .withApprover('Beto')
          .withInformer('ana@example.com')
          .withStatus('APPROVED')
          .withFileContent(VALID_PLAYBOOK)
          .withExecutionType(ExecutionType.ANSIBLE)
          .build(),
        { id: 12 },
      );
      const createExecution = jest.fn().mockResolvedValue(savedEntity);
      const execute = jest.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      });
      const repository = {
        createExecution,
      } as unknown as KubernetesRegisterRepository;
      const connector = {} as unknown as KubernetesConnector;
      const ansibleService = { execute } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );

      // A playbook is not a k8s manifest (no `kind`/`metadata.namespace`) —
      // this would be rejected by K8sTargetValidator if executeAnsiblePlaybook
      // mistakenly ran the manifest validation path.
      await expect(
        service.executeAnsiblePlaybook(
          buildDto({ fileContent: VALID_PLAYBOOK }),
        ),
      ).resolves.toBeDefined();
    });

    it('persists fileContent verbatim with executionType ANSIBLE and runs it through AnsibleService', async () => {
      const dto = buildDto({ fileContent: VALID_PLAYBOOK });
      const savedEntity = KubernetesRegisterEntity.builder()
        .withTicketNumber(dto.ticketNumber)
        .withDepartment(dto.department)
        .withApprover(dto.approver)
        .withInformer(dto.informer)
        .withStatus(dto.status)
        .withFileContent(dto.fileContent)
        .withExecutionType(ExecutionType.ANSIBLE)
        .build();
      Object.assign(savedEntity, { id: 13 });

      const createExecution = jest.fn().mockResolvedValue(savedEntity);
      const execute = jest.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'PLAY RECAP ok=1',
        stderr: '',
      });
      const repository = {
        createExecution,
      } as unknown as KubernetesRegisterRepository;
      const connector = {} as unknown as KubernetesConnector;
      const ansibleService = { execute } as unknown as AnsibleService;

      const service = new KubernetesService(
        repository,
        connector,
        ansibleService,
      );
      const response = await service.executeAnsiblePlaybook(dto);

      expect(createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          fileContent: dto.fileContent,
          executionType: ExecutionType.ANSIBLE,
        }),
      );
      expect(execute).toHaveBeenCalledWith(dto.fileContent);
      expect(response.data.execution).toEqual({
        success: true,
        exitCode: 0,
        stdout: 'PLAY RECAP ok=1',
        stderr: '',
      });
    });
  });
});
