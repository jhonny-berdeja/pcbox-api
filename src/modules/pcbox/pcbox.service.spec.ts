import { BadRequestException } from '@nestjs/common';
import { AdministrationsRepository } from '../../common/database/administration/administrations.repository';
import { AdministrationEntity } from '../../common/database/administration/administration.entity';
import { AnsibleService } from '../ansible/ansible.service';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { PcboxService } from './pcbox.service';

function buildDto(overrides: Partial<CreatePcboxDto> = {}) {
  const dto = new CreatePcboxDto();
  dto.ticketNumber = 1;
  dto.department = 'Datacenter';
  dto.approver = 'Beto';
  dto.informer = 'Ana';
  dto.status = 'APPROVED';
  dto.fileContent = '- hosts: all\n  tasks: []\n';
  return Object.assign(dto, overrides);
}

describe('PcboxService', () => {
  function buildService() {
    const execute = jest.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
    });
    const createAdministration = jest
      .fn()
      .mockImplementation((entity: AdministrationEntity) =>
        Promise.resolve(Object.assign(entity, { id: 1 })),
      );

    const administrationsRepository = {
      createAdministration,
    } as unknown as AdministrationsRepository;
    const ansibleService = { execute } as unknown as AnsibleService;

    const service = new PcboxService(administrationsRepository, ansibleService);

    return { service, execute, createAdministration };
  }

  it('gate 1: rejects a non-APPROVED status before parsing YAML or saving anything', async () => {
    const { service, execute, createAdministration } = buildService();

    await expect(
      service.create(buildDto({ status: 'CREATED' })),
    ).rejects.toThrow(BadRequestException);

    expect(execute).not.toHaveBeenCalled();
    expect(createAdministration).not.toHaveBeenCalled();
  });

  it('gate 2: rejects unparseable YAML before saving anything', async () => {
    const { service, execute, createAdministration } = buildService();

    await expect(
      service.create(buildDto({ fileContent: 'key: [unclosed' })),
    ).rejects.toThrow(BadRequestException);

    expect(execute).not.toHaveBeenCalled();
    expect(createAdministration).not.toHaveBeenCalled();
  });

  it('happy path: both gates pass, saves the record, then executes the playbook', async () => {
    const { service, execute, createAdministration } = buildService();

    const result = await service.create(buildDto());

    expect(createAdministration).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(buildDto().fileContent);
    expect(result).toEqual({
      msg: 'Administration saved and playbook execution finished',
      data: expect.objectContaining({
        id: 1,
        execution: { success: true, exitCode: 0 },
      }) as unknown,
    });
  });

  it('saves the record before running the playbook, not after', async () => {
    const { service, createAdministration, execute } = buildService();
    const callOrder: string[] = [];
    createAdministration.mockImplementation((entity: AdministrationEntity) => {
      callOrder.push('save');
      return Promise.resolve(Object.assign(entity, { id: 1 }));
    });
    execute.mockImplementation(() => {
      callOrder.push('execute');
      return Promise.resolve({
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
      });
    });

    await service.create(buildDto());

    expect(callOrder).toEqual(['save', 'execute']);
  });
});
