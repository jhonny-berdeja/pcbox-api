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
