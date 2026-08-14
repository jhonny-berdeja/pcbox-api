import { BadRequestException, Injectable } from '@nestjs/common';
import { AdministrationsRepository } from '../../common/database/administration/administrations.repository';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { PcboxMapper } from './pcbox.mapper';
import { PcboxResponse } from './pcbox-response';
import { TicketHubVerificationService } from '../ticket-hub-api/ticket-hub-verification.service';
import { AnsibleService } from '../ansible/ansible.service';
import { AnsibleValidator } from '../ansible/ansible.validator';

const APPROVED_STATUS = 'APPROVED';
const NOT_APPROVED_MESSAGE = `Only administrations with status '${APPROVED_STATUS}' can be executed`;

@Injectable()
export class PcboxService {
  constructor(
    private readonly administrationsRepository: AdministrationsRepository,
    private readonly ticketHubVerificationService: TicketHubVerificationService,
    private readonly ansibleService: AnsibleService,
  ) {}

  /**
   * Three gates, in this exact order, each one strictly cheaper than the
   * next — every gate has to pass before the next one even runs, and
   * nothing is written to `administrations` nor executed until all three
   * have:
   *
   * 1. `status === 'APPROVED'` — a local, in-memory string comparison, so
   *    an obviously-wrong request never spends a network round trip.
   * 2. ticket-hub-api's `GET /tickets/:number/verify` — a network call, so
   *    it only runs once the free check above already passed.
   * 3. `fileContent` parses as YAML — cheap CPU work, but only worth doing
   *    once the caller is already confirmed to hold a real, approved
   *    ticket; no point parsing a payload nobody was allowed to submit.
   */
  async create(dto: CreatePcboxDto): Promise<ResponseBody<PcboxResponse>> {
    this.assertApprovedStatus(dto.status);

    await this.ticketHubVerificationService.verify(dto);

    AnsibleValidator.assertValidYamlPlaybook(dto.fileContent);

    const entity = PcboxMapper.toEntity(dto);
    const savedAdministration =
      await this.administrationsRepository.createAdministration(entity);

    const execution = await this.ansibleService.execute(dto.fileContent);

    return ResponseBody.builder<PcboxResponse>()
      .withMsg('Administration saved and playbook execution finished')
      .withData(PcboxMapper.toResponse(savedAdministration, execution))
      .build();
  }

  private assertApprovedStatus(status: string): void {
    if (status !== APPROVED_STATUS) {
      throw new BadRequestException(NOT_APPROVED_MESSAGE);
    }
  }
}
