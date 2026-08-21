import 'reflect-metadata';
import { CreateDatabaseAdministrationDto } from './dto/create-database-administration.dto';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';
import { DatabaseMapper } from './database.mapper';

function buildDto(): CreateDatabaseAdministrationDto {
  const dto = new CreateDatabaseAdministrationDto();
  dto.ticketNumber = 2;
  dto.department = 'Datacenter';
  dto.approver = 'Beto';
  dto.informer = 'ana@example.com';
  dto.status = 'APPROVED';
  dto.namespace = 'databases';
  dto.deployment = 'postgres';
  dto.dbName = 'pcbox';
  dto.sqlCode = 'SELECT 1;';
  return dto;
}

describe('DatabaseMapper', () => {
  describe('toEntity', () => {
    it('copies the shared administration fields, renames dbName to database, and discards namespace/deployment/sqlCode', () => {
      const dto = buildDto();
      const entity = DatabaseMapper.toEntity(dto, 'templated-playbook');

      expect(entity).toMatchObject({
        ticketNumber: 2,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'ana@example.com',
        database: 'pcbox',
        status: 'APPROVED',
        sqlContent: 'templated-playbook',
        response: null,
      });
      expect(entity).not.toHaveProperty('namespace');
      expect(entity).not.toHaveProperty('deployment');
      expect(entity).not.toHaveProperty('sqlCode');
    });
  });

  describe('toResponse', () => {
    it('includes the full execution result, stdout/stderr included', () => {
      const dto = buildDto();
      const entity = Object.assign(
        DatabaseMapper.toEntity(dto, 'templated-playbook'),
        { id: 9 },
      );
      const execution: AnsibleExecutionResult = {
        success: true,
        exitCode: 0,
        stdout: '1\n(1 row)',
        stderr: '',
      };

      const response = DatabaseMapper.toResponse(entity, execution);

      expect(response).toEqual({
        id: 9,
        ticketNumber: 2,
        department: 'Datacenter',
        approver: 'Beto',
        informer: 'ana@example.com',
        database: 'pcbox',
        status: 'APPROVED',
        sqlContent: 'templated-playbook',
        response: null,
        execution: {
          success: true,
          exitCode: 0,
          stdout: '1\n(1 row)',
          stderr: '',
        },
      });
    });
  });
});
