import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseRegisterRepository } from '../../common/database/administration/database-register.repository';
import { ResponseBody } from '../../common/dto/response-body.dto';
import { CreateDatabaseAdministrationDto } from './dto/create-database-administration.dto';
import { DatabaseMapper } from './database.mapper';
import { DatabaseResponse } from './dto/database-response.dto';
import { AnsibleService } from '../ansible/ansible.service';
import { SqlPlaybookBuilder } from '../ansible/sql-playbook.builder';
import { DbTargetValidator } from './db-target.validator';

const APPROVED_STATUS = 'APPROVED';
const NOT_APPROVED_MESSAGE = `Only administrations with status '${APPROVED_STATUS}' can be executed`;

@Injectable()
export class DatabaseService {
  constructor(
    private readonly databaseRegisterRepository: DatabaseRegisterRepository,
    private readonly ansibleService: AnsibleService,
  ) {}

  async executeAdministrationPlaybook(
    dto: CreateDatabaseAdministrationDto,
  ): Promise<ResponseBody<DatabaseResponse>> {
    this.assertApprovedStatus(dto.status);
    DbTargetValidator.assertAllowed(dto.namespace, dto.deployment, dto.dbName);

    const fileContent = SqlPlaybookBuilder.build(
      {
        namespace: dto.namespace,
        deployment: dto.deployment,
        dbName: dto.dbName,
      },
      dto.sqlCode,
    );

    const entity = DatabaseMapper.toEntity(dto, fileContent);
    const savedAdministration =
      await this.databaseRegisterRepository.createAdministration(entity);

    const execution = await this.ansibleService.execute(fileContent);

    return ResponseBody.builder<DatabaseResponse>()
      .withMsg('Administration saved and playbook execution finished')
      .withData(DatabaseMapper.toResponse(savedAdministration, execution))
      .build();
  }

  private assertApprovedStatus(status: string): void {
    if (status !== APPROVED_STATUS) {
      throw new BadRequestException(NOT_APPROVED_MESSAGE);
    }
  }
}
