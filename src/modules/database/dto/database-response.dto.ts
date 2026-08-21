/**
 * HTTP response shape for `POST /database`. Neither `namespace` nor
 * `deployment` are exposed — `database_register` never persists them (see
 * `DatabaseRegisterEntity`), they are only consumed transiently to validate
 * the target and build the playbook.
 */
export interface DatabaseResponse {
  id: number;
  ticketNumber: number;
  department: string;
  approver: string;
  informer: string;
  database: string;
  status: string;
  sqlContent: string;
  response: string | null;
  execution: {
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
  };
}
