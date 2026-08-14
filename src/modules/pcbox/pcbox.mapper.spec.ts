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
      const entity = PcboxMapper.toEntity(buildDto());

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
    it('includes success/exitCode from the execution result, never stdout/stderr', () => {
      const entity = Object.assign(PcboxMapper.toEntity(buildDto()), {
        id: 7,
      });
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
        execution: { success: true, exitCode: 0 },
      });
      // The whole point of a dedicated `execution: {success, exitCode}`
      // shape: stdout/stderr must never leak into the HTTP response.
      expect(JSON.stringify(response)).not.toContain('PLAY [all]');
    });

    it('carries a failed run through the same shape, exitCode included', () => {
      const entity = Object.assign(PcboxMapper.toEntity(buildDto()), {
        id: 8,
      });
      const execution: AnsibleExecutionResult = {
        success: false,
        exitCode: 2,
        stdout: '',
        stderr: 'UNREACHABLE',
      };

      const response = PcboxMapper.toResponse(entity, execution);

      expect(response.execution).toEqual({ success: false, exitCode: 2 });
    });
  });
});
