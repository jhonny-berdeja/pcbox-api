/**
 * Public response shape for `POST /pcbox` — the saved record plus the
 * full result of the playbook run. `stdout`/`stderr` used to be
 * deliberately excluded here ("reveal the minimum" — see git history if
 * you need the old reasoning); now included on purpose so the caller
 * (a human admin, or ticket-hub-api's `ApproveTicketService`, see
 * pcbox-api's own `.claude/CLAUDE.md`) can show the complete execution
 * output, not just success/failure.
 */
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
    stdout: string;
    stderr: string;
  };
}
