import { BadRequestException } from '@nestjs/common';
import { DatabaseRegisterRepository } from '../../common/database/administration/database-register.repository';
import { DatabaseRegisterEntity } from '../../common/database/administration/database-register.entity';
import { AnsibleService } from '../ansible/ansible.service';
import { DatabaseService } from './database.service';
import { CreateDatabaseAdministrationDto } from './dto/create-database-administration.dto';

function buildDto(
  overrides: Partial<CreateDatabaseAdministrationDto> = {},
): CreateDatabaseAdministrationDto {
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
  return Object.assign(dto, overrides);
}

describe('DatabaseService', () => {
  it('rejects a non-APPROVED status before checking the target or touching the repository', async () => {
    const createAdministration = jest.fn();
    const execute = jest.fn();
    const repository = {
      createAdministration,
    } as unknown as DatabaseRegisterRepository;
    const ansibleService = { execute } as unknown as AnsibleService;

    const service = new DatabaseService(repository, ansibleService);

    await expect(
      service.executeAdministrationPlaybook(buildDto({ status: 'CREATED' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createAdministration).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('rejects a non-allowlisted target before saving or executing anything', async () => {
    const createAdministration = jest.fn();
    const execute = jest.fn();
    const repository = {
      createAdministration,
    } as unknown as DatabaseRegisterRepository;
    const ansibleService = { execute } as unknown as AnsibleService;

    const service = new DatabaseService(repository, ansibleService);

    await expect(
      service.executeAdministrationPlaybook(
        buildDto({ dbName: 'not-allowed-db' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createAdministration).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('templates the SQL playbook, persists it, and runs it with sqlCode delivered verbatim', async () => {
    const dto = buildDto();
    const savedEntity = DatabaseRegisterEntity.builder()
      .withTicketNumber(dto.ticketNumber)
      .withDepartment(dto.department)
      .withApprover(dto.approver)
      .withInformer(dto.informer)
      .withDatabase(dto.dbName)
      .withStatus(dto.status)
      .withSqlContent('placeholder')
      .build();
    Object.assign(savedEntity, { id: 9 });

    const createAdministration = jest.fn().mockResolvedValue(savedEntity);
    const execute = jest.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: '1\n(1 row)',
      stderr: '',
    });

    const repository = {
      createAdministration,
    } as unknown as DatabaseRegisterRepository;
    const ansibleService = { execute } as unknown as AnsibleService;

    const service = new DatabaseService(repository, ansibleService);
    await service.executeAdministrationPlaybook(dto);

    const calls = createAdministration.mock.calls as [DatabaseRegisterEntity][];
    const persistedSqlContent = calls[0][0].sqlContent;
    expect(persistedSqlContent).toContain('stdin: SELECT 1;');
    expect(persistedSqlContent).not.toContain('argv:\n        - SELECT');
    expect(execute).toHaveBeenCalledWith(persistedSqlContent);
  });
});
