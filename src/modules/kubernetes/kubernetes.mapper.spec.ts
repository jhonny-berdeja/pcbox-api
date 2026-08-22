import 'reflect-metadata';
import { CreateKubernetesDto } from './dto/create-kubernetes.dto';
import { K8sApplyResult } from './kubernetes.connector';
import { KubernetesMapper } from './kubernetes.mapper';

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
  describe('toEntity', () => {
    it('copies every DTO field as-is, deriving nothing', () => {
      const dto = buildDto();
      const entity = KubernetesMapper.toEntity(dto, dto.fileContent);

      expect(entity).toMatchObject({
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: 'apiVersion: v1\nkind: ConfigMap\n',
        response: null,
      });
    });
  });

  describe('toResponse', () => {
    it('lists every applied resource one per line and reports exitCode:null, stderr:"" on full success', () => {
      const dto = buildDto();
      const entity = Object.assign(
        KubernetesMapper.toEntity(dto, dto.fileContent),
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

      const response = KubernetesMapper.toResponse(entity, result);

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
        KubernetesMapper.toEntity(dto, dto.fileContent),
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

      const response = KubernetesMapper.toResponse(entity, result);

      expect(response.execution).toEqual({
        success: false,
        exitCode: null,
        stdout: 'Deployment/my-app in ticket-hub: configured',
        stderr: 'Failed to apply Service/my-app in ticket-hub: boom',
      });
    });
  });
});
