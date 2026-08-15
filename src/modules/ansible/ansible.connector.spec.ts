import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { AnsibleConnector } from './ansible.connector';

jest.mock('node:child_process');
jest.mock('node:fs/promises');

const mockedExecFile = execFile as unknown as jest.Mock;
const mockedMkdtemp = mkdtemp as jest.Mock;
const mockedWriteFile = writeFile as jest.Mock;
const mockedRm = rm as jest.Mock;

function buildConfigService(): ConfigService {
  const values: Record<string, string> = {
    PCBOX_SSH_HOST: '100.64.0.1',
    PCBOX_SSH_USER: 'jhon',
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('AnsibleConnector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMkdtemp.mockResolvedValue('/tmp/pcbox-playbook-abc123');
    mockedWriteFile.mockResolvedValue(undefined);
    mockedRm.mockResolvedValue(undefined);
  });

  it('writes the playbook to a temp file and invokes ansible-playbook with the SSH host/user/private key', async () => {
    mockedExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, 'PLAY [all] ***', '');
      },
    );
    const connector = new AnsibleConnector(buildConfigService());

    const result = await connector.executePlaybook(
      '- hosts: all\n  tasks: []\n',
    );

    expect(result).toEqual({
      success: true,
      exitCode: 0,
      stdout: 'PLAY [all] ***',
      stderr: '',
    });
    expect(mockedWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/pcbox-playbook-abc123'),
      '- hosts: all\n  tasks: []\n',
      'utf8',
    );
    expect(mockedExecFile).toHaveBeenCalledWith(
      'ansible-playbook',
      expect.arrayContaining([
        '-i',
        '100.64.0.1,',
        '-u',
        'jhon',
        '--private-key',
        '/etc/ssh-keys/pcbox_deploy_key',
        '--ssh-common-args',
        '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
      ]) as unknown,
      expect.any(Object) as unknown,
      expect.any(Function) as unknown,
    );
  });

  it('always removes the temp dir, success or failure', async () => {
    mockedExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(null, '', '');
      },
    );
    const connector = new AnsibleConnector(buildConfigService());

    await connector.executePlaybook('- hosts: all\n  tasks: []\n');

    expect(mockedRm).toHaveBeenCalledWith(
      expect.stringContaining('/tmp/pcbox-playbook-abc123'),
      { recursive: true, force: true },
    );
  });

  it('surfaces a non-zero ansible-playbook exit as success:false, not a thrown error', async () => {
    mockedExecFile.mockImplementation(
      (
        _cmd: string,
        _args: string[],
        _opts: unknown,
        callback: (
          error: (Error & { code?: number }) | null,
          stdout: string,
          stderr: string,
        ) => void,
      ) => {
        const error = Object.assign(new Error('Command failed'), {
          code: 2,
        });
        callback(error, '', 'UNREACHABLE');
      },
    );
    const connector = new AnsibleConnector(buildConfigService());

    const result = await connector.executePlaybook(
      '- hosts: all\n  tasks: []\n',
    );

    expect(result).toEqual({
      success: false,
      exitCode: 2,
      stdout: '',
      stderr: 'UNREACHABLE',
    });
    // Removed even though the run failed.
    expect(mockedRm).toHaveBeenCalledTimes(1);
  });
});
