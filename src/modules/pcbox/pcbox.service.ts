import { BadRequestException, Injectable } from '@nestjs/common';
import { AdministrationsRepository } from '../../common/database/administration/administrations.repository';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { DatabaseActionDto } from './dto/database-action.dto';
import { PcboxMapper } from './pcbox.mapper';
import { PcboxResponse } from './dto/pcbox-response.dto';
import { AnsibleService } from '../ansible/ansible.service';
import { AnsibleValidator } from '../ansible/ansible.validator';
import { SqlPlaybookBuilder } from '../ansible/sql-playbook.builder';
import { DbTargetValidator } from './db-target.validator';
import { TicketType } from './value-objects/ticket-type.enum';

const APPROVED_STATUS = 'APPROVED';
const NOT_APPROVED_MESSAGE = `Only administrations with status '${APPROVED_STATUS}' can be executed`;
const MISSING_FILE_CONTENT_MESSAGE =
  'fileContent is required for ANSIBLE tickets';
const MISSING_DATABASE_MESSAGE = 'database is required for DATABASE tickets';

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

    const ticketType = dto.ticketType ?? TicketType.ANSIBLE;
    const fileContent = this.resolveFileContent(ticketType, dto);

    const entity = PcboxMapper.toEntity(dto, fileContent);
    const savedAdministration =
      await this.administrationsRepository.createAdministration(entity);

    const execution = await this.ansibleService.execute(fileContent);

    return ResponseBody.builder<PcboxResponse>()
      .withMsg('Administration saved and playbook execution finished')
      .withData(PcboxMapper.toResponse(savedAdministration, execution))
      .build();
  }

  private resolveFileContent(
    ticketType: TicketType,
    dto: CreatePcboxDto,
  ): string {
    if (ticketType === TicketType.DATABASE) {
      return this.buildDatabasePlaybook(dto.database);
    }
    return this.assertAnsiblePlaybook(dto.fileContent);
  }

  private assertAnsiblePlaybook(fileContent: string | undefined): string {
    if (!fileContent) {
      throw new BadRequestException(MISSING_FILE_CONTENT_MESSAGE);
    }
    AnsibleValidator.assertValidYamlPlaybook(fileContent);
    return fileContent;
  }

  private buildDatabasePlaybook(
    database: DatabaseActionDto | undefined,
  ): string {
    if (!database) {
      throw new BadRequestException(MISSING_DATABASE_MESSAGE);
    }
    DbTargetValidator.assertAllowed(
      database.namespace,
      database.deployment,
      database.dbName,
    );
    return SqlPlaybookBuilder.build(
      {
        namespace: database.namespace,
        deployment: database.deployment,
        dbName: database.dbName,
      },
      database.sqlCode,
    );
  }

  private assertApprovedStatus(status: string): void {
    if (status !== APPROVED_STATUS) {
      throw new BadRequestException(NOT_APPROVED_MESSAGE);
    }
  }
}
