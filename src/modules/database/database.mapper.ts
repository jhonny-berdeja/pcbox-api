import { AdministrationEntity } from '../../common/database/administration/administration.entity';
import { AdministrationMapper } from '../../common/database/administration/administration.mapper';
import { CreateDatabaseAdministrationDto } from './dto/create-database-administration.dto';
import { DatabaseResponse } from './dto/database-response.dto';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';

/** Thin per-module wrapper around the shared `AdministrationMapper` — see that class for why the actual entity/response mapping lives there instead of here. */
export class DatabaseMapper {
  static toEntity(
    dto: CreateDatabaseAdministrationDto,
    fileContent: string,
  ): AdministrationEntity {
    return AdministrationMapper.toEntity(dto, fileContent);
  }

  static toResponse(
    administration: AdministrationEntity,
    execution: AnsibleExecutionResult,
  ): DatabaseResponse {
    return AdministrationMapper.toResponse(administration, execution);
  }
}
