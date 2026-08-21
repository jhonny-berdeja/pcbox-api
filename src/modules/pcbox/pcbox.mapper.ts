import { AdministrationEntity } from '../../common/database/administration/administration.entity';
import { AdministrationMapper } from '../../common/database/administration/administration.mapper';
import { CreatePcboxDto } from './dto/create-pcbox.dto';
import { PcboxResponse } from './dto/pcbox-response.dto';
import { AnsibleExecutionResult } from '../ansible/ansible.dto';

/** Thin per-module wrapper around the shared `AdministrationMapper` — see that class for why the actual entity/response mapping lives there instead of here. */
export class PcboxMapper {
  static toEntity(
    dto: CreatePcboxDto,
    fileContent: string,
  ): AdministrationEntity {
    return AdministrationMapper.toEntity(dto, fileContent);
  }

  static toResponse(
    administration: AdministrationEntity,
    execution: AnsibleExecutionResult,
  ): PcboxResponse {
    return AdministrationMapper.toResponse(administration, execution);
  }
}
