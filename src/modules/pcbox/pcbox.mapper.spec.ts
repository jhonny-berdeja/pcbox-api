import 'reflect-metadata';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';
import { PcboxMapper } from './pcbox.mapper';

function buildDto(): CreatePcboxDto {
  const dto = new CreatePcboxDto();
  dto.ticketNumber = 1;
  dto.department = 'Datacenter';
  dto.approver = 'Beto';
  dto.informer = 'Ana';
  dto.status = 'APPROVED';
  dto.fileContent = '- hosts: all\n  tasks: []\n';
  return dto;
}

describe('PcboxMapper', () => {
  describe('toEntity', () => {
    it('copies every DTO field as-is, deriving nothing', () => {
      const dto = buildDto();
      const entity = PcboxMapper.toEntity(dto, dto.fileContent!);

      expect(entity).toMatchObject({
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: '- hosts: all\n  tasks: []\n',
      });
    });
  });

  describe('toResponse', () => {
    it('includes the full execution result, stdout/stderr included', () => {
      const dto = buildDto();
      const entity = Object.assign(
        PcboxMapper.toEntity(dto, dto.fileContent!),
        {
          id: 7,
        },
      );
      const execution: AnsibleExecutionResult = {
        success: true,
        exitCode: 0,
        stdout: 'PLAY [all] ***',
        stderr: '',
      };

      const response = PcboxMapper.toResponse(entity, execution);

      expect(response).toEqual({
        id: 7,
        ticketNumber: 1,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'Ana',
        status: 'APPROVED',
        fileContent: '- hosts: all\n  tasks: []\n',
        execution: {
          success: true,
          exitCode: 0,
          stdout: 'PLAY [all] ***',
          stderr: '',
        },
      });
    });

    it('carries a failed run through the same shape, exitCode and stderr included', () => {
      const dto = buildDto();
      const entity = Object.assign(
        PcboxMapper.toEntity(dto, dto.fileContent!),
        {
          id: 8,
        },
      );
      const execution: AnsibleExecutionResult = {
        success: false,
        exitCode: 2,
        stdout: '',
        stderr: 'UNREACHABLE',
      };

      const response = PcboxMapper.toResponse(entity, execution);

      expect(response.execution).toEqual({
        success: false,
        exitCode: 2,
        stdout: '',
        stderr: 'UNREACHABLE',
      });
    });
  });
});
