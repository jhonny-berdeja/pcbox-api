import { AnsiblePlaybookExecutionError } from './ansible.exception';
import { AnsibleExecutionResult } from './ansible.dto';

export class AnsibleMapper {
  static toSuccessResult(
    stdout: string,
    stderr: string,
  ): AnsibleExecutionResult {
    return AnsibleExecutionResult.builder()
      .withSuccess(true)
      .withExitCode(0)
      .withStdout(stdout)
      .withStderr(stderr)
      .build();
  }

  static toFailureResult(
    error: AnsiblePlaybookExecutionError,
  ): AnsibleExecutionResult {
    return AnsibleExecutionResult.builder()
      .withSuccess(false)
      .withExitCode(typeof error.exitCode === 'number' ? error.exitCode : null)
      .withStdout(error.stdout)
      .withStderr(error.stderr || error.message)
      .build();
  }
}
