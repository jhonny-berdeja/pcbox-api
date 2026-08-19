import { AdministrationsRepository } from '../../common/database/administration/administrations.repository';
import { AdministrationEntity } from '../../common/database/administration/administration.entity';
import { AnsibleService } from '../ansible/ansible.service';
import { PcboxService } from './pcbox.service';
import { CreatePcboxDto } from './dto/create-pcbox.dto';

/**
 * Approval test (strict-tdd.md "Approval Testing" section): captures the
 * CURRENT ANSIBLE behavior of PcboxService before it's refactored (task
 * 3.4) to branch by `ticketType`. Must pass now (baseline) and must still
 * pass, unmodified in assertions, once the DATABASE branch is added — that
 * is the whole point of task 2.4 ("ANSIBLE ticket path behavior unchanged
 * when ticketType=ANSIBLE").
 */
describe('PcboxService — ANSIBLE path stays unchanged after ticketType branching', () => {
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

    const savedEntity = AdministrationEntity.builder()
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
    } as unknown as AdministrationsRepository;
    const ansibleService = { execute } as unknown as AnsibleService;

    const service = new PcboxService(repository, ansibleService);
    await service.executeAdministrationPlaybook(dto);

    expect(execute).toHaveBeenCalledWith(fileContent);
    expect(createAdministration).toHaveBeenCalledWith(
      expect.objectContaining({ fileContent }),
    );
  });
});
