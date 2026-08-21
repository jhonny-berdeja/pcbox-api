/** HTTP response shape for `POST /pcbox`. */
export interface PcboxResponse {
  id: number;
  ticketNumber: number;
  department: string;
  approver: string;
  informer: string;
  status: string;
  fileContent: string;
  response: string | null;
  execution: {
    success: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
  };
}
