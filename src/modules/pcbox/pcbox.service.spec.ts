import { DatacenterRegisterRepository } from '../../common/database/administration/datacenter-register.repository';
import { DatacenterRegisterEntity } from '../../common/database/administration/datacenter-register.entity';
import { AnsibleService } from '../ansible/ansible.service';
import { PcboxService } from './pcbox.service';
import { CreatePcboxDto } from './dto/create-pcbox.dto';

/**
 * `PcboxService` is now Ansible-only — the DATABASE ticket path lives in
 * its own `DatabaseService` (`src/modules/database/`).
 */
describe('PcboxService — Ansible administration execution', () => {
  it('persists fileContent as-is and runs it through AnsibleService', async () => {
    const fileContent = '- hosts: all\n  tasks: []';
    const dto: CreatePcboxDto = {
      ticketNumber: 42,
      department: 'Datacenter',
      approver: 'Jane',
      informer: 'jane@example.com',
      status: 'APPROVED',
      fileContent,
    };

    const savedEntity = DatacenterRegisterEntity.builder()
      .withTicketNumber(dto.ticketNumber)
      .withDepartment(dto.department)
      .withApprover(dto.approver)
      .withInformer(dto.informer)
      .withStatus(dto.status)
      .withFileContent(fileContent)
      .build();

    const createAdministration = jest.fn().mockResolvedValue(savedEntity);
    const execute = jest.fn().mockResolvedValue({
      success: true,
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
    });

    const repository = {
      createAdministration,
    } as unknown as DatacenterRegisterRepository;
    const ansibleService = { execute } as unknown as AnsibleService;

    const service = new PcboxService(repository, ansibleService);
    await service.executeAdministrationPlaybook(dto);

    expect(execute).toHaveBeenCalledWith(fileContent);
    expect(createAdministration).toHaveBeenCalledWith(
      expect.objectContaining({ fileContent }),
    );
  });
});
