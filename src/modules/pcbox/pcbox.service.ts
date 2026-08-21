import { BadRequestException, Injectable } from '@nestjs/common';
import { AdministrationsRepository } from '../../common/database/administration/administrations.repository';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { PcboxMapper } from './pcbox.mapper';
import { PcboxResponse } from './dto/pcbox-response.dto';
import { AnsibleService } from '../ansible/ansible.service';
import { AnsibleValidator } from '../ansible/ansible.validator';

const APPROVED_STATUS = 'APPROVED';
const NOT_APPROVED_MESSAGE = `Only administrations with status '${APPROVED_STATUS}' can be executed`;

@Injectable()
export class PcboxService {
  constructor(
    private readonly administrationsRepository: AdministrationsRepository,
    private readonly ansibleService: AnsibleService,
  ) {}

  async executeAdministrationPlaybook(
    dto: CreatePcboxDto,
  ): Promise<ResponseBody<PcboxResponse>> {
    this.assertApprovedStatus(dto.status);
    AnsibleValidator.assertValidYamlPlaybook(dto.fileContent);

    const entity = PcboxMapper.toEntity(dto, dto.fileContent);
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
