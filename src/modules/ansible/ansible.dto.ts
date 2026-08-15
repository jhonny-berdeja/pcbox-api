export class AnsibleExecutionResult {
  success!: boolean;
  exitCode!: number | null;
  stdout!: string;
  stderr!: string;

  static builder(): AnsibleExecutionResultBuilder {
    return new AnsibleExecutionResultBuilder();
  }
}

export class AnsibleExecutionResultBuilder {
  private success?: boolean;
  private exitCode?: number | null;
  private stdout?: string;
  private stderr?: string;

  withSuccess(success: boolean): this {
    this.success = success;
    return this;
  }

  withExitCode(exitCode: number | null): this {
    this.exitCode = exitCode;
    return this;
  }

  withStdout(stdout: string): this {
    this.stdout = stdout;
    return this;
  }

  withStderr(stderr: string): this {
    this.stderr = stderr;
    return this;
  }

  build(): AnsibleExecutionResult {
    if (this.success === undefined) {
      throw new Error('AnsibleExecutionResult.Builder: success is required');
    }
    if (this.exitCode === undefined) {
      throw new Error('AnsibleExecutionResult.Builder: exitCode is required');
    }
    if (this.stdout === undefined) {
      throw new Error('AnsibleExecutionResult.Builder: stdout is required');
    }
    if (this.stderr === undefined) {
      throw new Error('AnsibleExecutionResult.Builder: stderr is required');
    }

    const result = new AnsibleExecutionResult();
    result.success = this.success;
    result.exitCode = this.exitCode;
    result.stdout = this.stdout;
    result.stderr = this.stderr;
    return result;
  }
}
