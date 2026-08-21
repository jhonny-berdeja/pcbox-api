import { AdministrationEntity } from './administration.entity';
import { AnsibleExecutionResult } from '../../../modules/ansible/ansible.dto';

/** The administration fields every ticket type (`pcbox`, `database`) shares — everything on `AdministrationEntity` except the already-derived `fileContent`. */
export interface AdministrationFields {
  ticketNumber: number;
  department: string;
  approver: string;
  informer: string;
  status: string;
}

/** Public HTTP response shape for an executed administration — shared verbatim by `pcbox`'s and `database`'s response DTOs (`PcboxResponse`/`DatabaseResponse`). */
export interface AdministrationResponse {
  id: number;
  ticketNumber: number;
  department: string;
  approver: string;
  informer: string;
  status: string;
  fileContent: string;
  execution: {
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
  };
}

/**
 * Shared `AdministrationEntity` <-> HTTP-shape mapping. Both `pcbox`
 * (Ansible tickets) and `database` (DB tickets) write to the same
 * `administrations` table via the same entity and expose the same response
 * shape — only *how* `fileContent` gets derived differs (raw playbook vs.
 * SQL-templated playbook via `SqlPlaybookBuilder`), and that derivation
 * already happens before either module calls this mapper. Kept beside the
 * entity/repository (rather than duplicated in each feature module's own
 * root mapper) so neither module has to import the other's mapper just to
 * avoid re-implementing this. `PcboxMapper`/`DatabaseMapper` are thin
 * per-module wrappers around this — see `project-structure-conventions.md`
 * for why each HTTP-exposing module still gets its own dedicated mapper.
 */
export class AdministrationMapper {
  static toEntity(
    fields: AdministrationFields,
    fileContent: string,
  ): AdministrationEntity {
    return AdministrationEntity.builder()
      .withTicketNumber(fields.ticketNumber)
      .withDepartment(fields.department)
      .withApprover(fields.approver)
      .withInformer(fields.informer)
      .withStatus(fields.status)
      .withFileContent(fileContent)
      .build();
  }

  static toResponse(
    administration: AdministrationEntity,
    execution: AnsibleExecutionResult,
  ): AdministrationResponse {
    return {
      id: administration.id,
      ticketNumber: administration.ticketNumber,
      department: administration.department,
      approver: administration.approver,
      informer: administration.informer,
      status: administration.status,
      fileContent: administration.fileContent,
      execution: {
        success: execution.success,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
      },
    };
  }
}
