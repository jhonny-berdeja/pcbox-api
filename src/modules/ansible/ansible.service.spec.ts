import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AnsibleConnector } from './ansible.connector';
import { AnsibleService } from './ansible.service';

function buildConfigService(): ConfigService {
  return { get: () => '100.64.0.1' } as unknown as ConfigService;
}

describe('AnsibleService', () => {
  it('rejects unparseable YAML before ever calling the connector', async () => {
    const executePlaybook = jest.fn();
    const connector = { executePlaybook } as unknown as AnsibleConnector;
    const logger = { log: jest.fn(), error: jest.fn() } as unknown as Logger;
    const service = new AnsibleService(connector, buildConfigService(), logger);

    await expect(
      service.execute('this is: [ not, valid, yaml'),
    ).rejects.toThrow();

    expect(executePlaybook).not.toHaveBeenCalled();
  });

  it('delegates to the connector and returns its result unchanged', async () => {
    const result = {
      success: true,
      exitCode: 0,
      stdout: 'PLAY [all] ***',
      stderr: '',
    };
    const executePlaybook = jest.fn().mockResolvedValue(result);
    const connector = { executePlaybook } as unknown as AnsibleConnector;
    const logger = { log: jest.fn(), error: jest.fn() } as unknown as Logger;
    const service = new AnsibleService(connector, buildConfigService(), logger);

    const returned = await service.execute('- hosts: all\n  tasks: []\n');

    expect(executePlaybook).toHaveBeenCalledWith('- hosts: all\n  tasks: []\n');
    expect(returned).toBe(result);
  });

  it('logs a successful run at "log" level (pino info)', async () => {
    const logSpy = jest.fn();
    const connector = {
      executePlaybook: jest.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        stdout: 'PLAY [all] ***',
        stderr: '',
      }),
    } as unknown as AnsibleConnector;
    const logger = { log: logSpy, error: jest.fn() } as unknown as Logger;
    const service = new AnsibleService(connector, buildConfigService(), logger);

    await service.execute('- hosts: all\n  tasks: []\n');

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        exitCode: 0,
        stdout: 'PLAY [all] ***',
        sshHost: '100.64.0.1',
        msg: 'Ansible playbook execution against pcbox',
      }) as unknown,
    );
  });

  it('logs a failed run at "error" level, full stdout/stderr included', async () => {
    const errorSpy = jest.fn();
    const connector = {
      executePlaybook: jest.fn().mockResolvedValue({
        success: false,
        exitCode: 2,
        stdout: '',
        stderr: 'UNREACHABLE',
      }),
    } as unknown as AnsibleConnector;
    const logger = { log: jest.fn(), error: errorSpy } as unknown as Logger;
    const service = new AnsibleService(connector, buildConfigService(), logger);

    await service.execute('- hosts: all\n  tasks: []\n');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        exitCode: 2,
        stderr: 'UNREACHABLE',
      }) as unknown,
    );
  });
});
