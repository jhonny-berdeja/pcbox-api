import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnsiblePlaybookExecutionError } from './ansible.exception';
import { AnsibleExecutionResult } from './ansible.dto';
import { AnsibleMapper } from './ansible.mapper';

@Injectable()
export class AnsibleConnector {
  private static readonly PLAYBOOK_TIMEOUT_MS = 120_000;
  private static readonly PLAYBOOK_FILE_NAME = 'playbook.yml';
  private static readonly SSH_PRIVATE_KEY_PATH =
    '/etc/ssh-keys/pcbox_deploy_key';

  constructor(private readonly configService: ConfigService) {}

  async executePlaybook(fileContent: string): Promise<AnsibleExecutionResult> {
    const sshHost = this.configService.get<string>('PCBOX_SSH_HOST')!;
    const sshUser = this.configService.get<string>('PCBOX_SSH_USER')!;

    const tempDir = await mkdtemp(join(tmpdir(), 'pcbox-playbook-'));
    const playbookPath = join(tempDir, AnsibleConnector.PLAYBOOK_FILE_NAME);

    try {
      await writeFile(playbookPath, fileContent, 'utf8');
      return await this.runAnsiblePlaybook(playbookPath, sshHost, sshUser);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async runAnsiblePlaybook(
    playbookPath: string,
    sshHost: string,
    sshUser: string,
  ): Promise<AnsibleExecutionResult> {
    try {
      const { stdout, stderr } = await this.execFileAsync(
        'ansible-playbook',
        this.buildPlaybookArgs(playbookPath, sshHost, sshUser),
        this.buildExecOptions(),
      );
      return AnsibleMapper.toSuccessResult(stdout, stderr);
    } catch (error) {
      if (!(error instanceof AnsiblePlaybookExecutionError)) {
        throw error;
      }
      return AnsibleMapper.toFailureResult(error);
    }
  }

  private buildPlaybookArgs(
    playbookPath: string,
    sshHost: string,
    sshUser: string,
  ): string[] {
    return [
      '-i',
      `${sshHost},`,
      '-u',
      sshUser,
      '--private-key',
      AnsibleConnector.SSH_PRIVATE_KEY_PATH,
      // This container is ephemeral — it never has pcbox's SSH host key
      // in a persisted known_hosts, so strict checking fails every
      // single connection, not just the first. Private-key auth already
      // establishes who WE are to the server; this only skips verifying
      // who the server is to us, acceptable here since the target is a
      // single fixed host reachable only over the private Tailscale
      // overlay, never the public internet.
      '--ssh-common-args',
      '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
      playbookPath,
    ];
  }

  private buildExecOptions(): { timeout: number } {
    return { timeout: AnsibleConnector.PLAYBOOK_TIMEOUT_MS };
  }

  private execFileAsync(
    command: string,
    args: string[],
    options: { timeout: number },
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(command, args, options, (error, stdout, stderr) => {
        if (error) {
          reject(
            new AnsiblePlaybookExecutionError(
              error.message,
              error.code,
              stdout,
              stderr,
            ),
          );
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  }
}
