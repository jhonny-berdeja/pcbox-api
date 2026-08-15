import { AnsiblePlaybookExecutionError } from './ansible.exception';
import { AnsibleMapper } from './ansible.mapper';

describe('AnsibleMapper', () => {
  describe('toSuccessResult', () => {
    it('builds a success result with exitCode 0', () => {
      const result = AnsibleMapper.toSuccessResult('PLAY [all] ***', '');

      expect(result).toEqual({
        success: true,
        exitCode: 0,
        stdout: 'PLAY [all] ***',
        stderr: '',
      });
    });
  });

  describe('toFailureResult', () => {
    it('carries the error exit code/stdout/stderr through', () => {
      const error = new AnsiblePlaybookExecutionError(
        'Command failed',
        2,
        '',
        'UNREACHABLE',
      );

      const result = AnsibleMapper.toFailureResult(error);

      expect(result).toEqual({
        success: false,
        exitCode: 2,
        stdout: '',
        stderr: 'UNREACHABLE',
      });
    });

    it('normalizes a non-numeric exit code (e.g. a timeout) to null', () => {
      const error = new AnsiblePlaybookExecutionError(
        'Command timed out',
        undefined,
        '',
        '',
      );

      const result = AnsibleMapper.toFailureResult(error);

      expect(result.exitCode).toBeNull();
    });

    it('falls back to the error message when stderr is empty', () => {
      const error = new AnsiblePlaybookExecutionError(
        'spawn ansible-playbook ENOENT',
        null,
        '',
        '',
      );

      const result = AnsibleMapper.toFailureResult(error);

      expect(result.stderr).toBe('spawn ansible-playbook ENOENT');
    });
  });
});
