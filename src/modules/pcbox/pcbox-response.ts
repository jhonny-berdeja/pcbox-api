/** Public response shape for `POST /pcbox` — the saved record plus a clear confirmation of the playbook run (full stdout/stderr stay in the log, never the HTTP response — see AnsibleService). */
export interface PcboxResponse {
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
  };
}
