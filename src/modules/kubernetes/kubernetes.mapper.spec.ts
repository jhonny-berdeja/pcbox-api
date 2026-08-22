import 'reflect-metadata';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';
import { K8sApplyResult } from './kubernetes.connector';
import { KubernetesMapper } from './kubernetes.mapper';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';
import { ExecutionType } from './value-objects/execution-type.enum';

function buildDto(): CreateKubernetesDto {
  const dto = new CreateKubernetesDto();
  dto.ticketNumber = 1;
  dto.department = 'Datacenter';
  dto.approver = 'Beto';
  dto.informer = 'Ana';
  dto.status = 'APPROVED';
  dto.fileContent = 'apiVersion: v1\nkind: ConfigMap\n';
  return dto;
}

describe('KubernetesMapper', () => {
  describe('toManifestEntity', () => {
    it('copies every DTO field as-is, stamping executionType MANIFEST', () => {
      const dto = buildDto();
      const entity = KubernetesMapper.toManifestEntity(dto, dto.fileContent);

      expect(entity).toMatchObject({
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: 'apiVersion: v1\nkind: ConfigMap\n',
        response: null,
        executionType: ExecutionType.MANIFEST,
      });
    });
  });

  describe('toAnsibleEntity', () => {
    it('copies every DTO field as-is, stamping executionType ANSIBLE', () => {
      const dto = buildDto();
      const entity = KubernetesMapper.toAnsibleEntity(dto, dto.fileContent);

      expect(entity).toMatchObject({
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: 'apiVersion: v1\nkind: ConfigMap\n',
        response: null,
        executionType: ExecutionType.ANSIBLE,
      });
    });
  });

  describe('toManifestResponse', () => {
    it('lists every applied resource one per line and reports exitCode:null, stderr:"" on full success', () => {
      const dto = buildDto();
      const entity = Object.assign(
        KubernetesMapper.toManifestEntity(dto, dto.fileContent),
        { id: 7 },
      );
      const result: K8sApplyResult = {
        success: true,
        applied: [
          {
            kind: 'Deployment',
            namespace: 'ticket-hub',
            name: 'my-app',
            action: 'configured',
          },
          {
            kind: 'Service',
            namespace: 'ticket-hub',
            name: 'my-app',
            action: 'created',
          },
        ],
        errorMessage: null,
      };

      const response = KubernetesMapper.toManifestResponse(entity, result);

      expect(response).toEqual({
        id: 7,
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: 'apiVersion: v1\nkind: ConfigMap\n',
        response: null,
        execution: {
          success: true,
          exitCode: null,
          stdout:
            'Deployment/my-app in ticket-hub: configured\nService/my-app in ticket-hub: created',
          stderr: '',
        },
      });
    });

    it('surfaces a partial failure: stdout lists only what applied before the failure, stderr carries errorMessage', () => {
      const dto = buildDto();
      const entity = Object.assign(
        KubernetesMapper.toManifestEntity(dto, dto.fileContent),
        { id: 8 },
      );
      const result: K8sApplyResult = {
        success: false,
        applied: [
          {
            kind: 'Deployment',
            namespace: 'ticket-hub',
            name: 'my-app',
            action: 'configured',
          },
        ],
        errorMessage: 'Failed to apply Service/my-app in ticket-hub: boom',
      };

      const response = KubernetesMapper.toManifestResponse(entity, result);

      expect(response.execution).toEqual({
        success: false,
        exitCode: null,
        stdout: 'Deployment/my-app in ticket-hub: configured',
        stderr: 'Failed to apply Service/my-app in ticket-hub: boom',
      });
    });
  });

  describe('toAnsibleResponse', () => {
    it('passes success/exitCode/stdout/stderr through as-is from AnsibleExecutionResult', () => {
      const dto = buildDto();
      const entity = Object.assign(
        KubernetesMapper.toAnsibleEntity(dto, dto.fileContent),
        { id: 9 },
      );
      const result: AnsibleExecutionResult = AnsibleExecutionResult.builder()
        .withSuccess(true)
        .withExitCode(0)
        .withStdout('PLAY RECAP ok=1')
        .withStderr('')
        .build();

      const response = KubernetesMapper.toAnsibleResponse(entity, result);

      expect(response).toEqual({
        id: 9,
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: 'apiVersion: v1\nkind: ConfigMap\n',
        response: null,
        execution: {
          success: true,
          exitCode: 0,
          stdout: 'PLAY RECAP ok=1',
          stderr: '',
        },
      });
    });

    it('surfaces a failed playbook run with its non-zero exitCode and stderr', () => {
      const dto = buildDto();
      const entity = Object.assign(
        KubernetesMapper.toAnsibleEntity(dto, dto.fileContent),
        { id: 10 },
      );
      const result: AnsibleExecutionResult = AnsibleExecutionResult.builder()
        .withSuccess(false)
        .withExitCode(2)
        .withStdout('')
        .withStderr('ERROR! task failed')
        .build();

      const response = KubernetesMapper.toAnsibleResponse(entity, result);

      expect(response.execution).toEqual({
        success: false,
        exitCode: 2,
        stdout: '',
        stderr: 'ERROR! task failed',
      });
    });
  });
});
