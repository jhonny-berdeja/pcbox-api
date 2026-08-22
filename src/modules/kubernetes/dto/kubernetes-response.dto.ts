/** HTTP response shape for `POST /kubernetes`. */
export interface KubernetesResponse {
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
