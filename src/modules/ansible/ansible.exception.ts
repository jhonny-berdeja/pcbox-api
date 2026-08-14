export class AnsiblePlaybookExecutionError extends Error {
  constructor(
    message: string,
    readonly exitCode: number | string | null | undefined,
    readonly stdout: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'AnsiblePlaybookExecutionError';
  }
}
