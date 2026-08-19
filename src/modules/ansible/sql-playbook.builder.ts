import { dump } from 'js-yaml';
import { DbTarget } from '../pcbox/value-objects/db-target.allowlist';

const STATEMENT_TIMEOUT_MS = 90000;

/**
 * Templates a single-play Ansible playbook that runs `sqlCode` against
 * `target` via `kubectl exec ... psql`, reusing the existing
 * `AnsibleConnector`/SSH pipeline unchanged. `sqlCode` is never
 * string-concatenated into YAML or shell syntax: it is a plain object
 * value assigned to the `stdin` key, and `js-yaml.dump()` handles all
 * escaping. `namespace`/`deployment`/`dbName` come only from an
 * allowlisted `DbTarget` (server constants, not user input) — see
 * `DbTargetValidator`.
 */
export class SqlPlaybookBuilder {
  static build(target: DbTarget, sqlCode: string): string {
    const shCommand = SqlPlaybookBuilder.buildShCommand(target.dbName);

    const playbook = [
      {
        hosts: 'all',
        gather_facts: false,
        tasks: [
          {
            name: `Run SQL on ${target.dbName}`,
            'ansible.builtin.command': {
              argv: [
                'microk8s',
                'kubectl',
                'exec',
                '-i',
                '-n',
                target.namespace,
                `deployment/${target.deployment}`,
                '--',
                'sh',
                '-c',
                shCommand,
              ],
              stdin: sqlCode,
            },
            register: 'sql',
            failed_when: false,
          },
          { 'ansible.builtin.debug': { var: 'sql.stdout_lines' } },
          { 'ansible.builtin.debug': { var: 'sql.stderr_lines' } },
          {
            'ansible.builtin.fail': { msg: 'psql exited {{ sql.rc }}' },
            when: 'sql.rc != 0',
          },
        ],
      },
    ];

    return dump(playbook);
  }

  private static buildShCommand(dbName: string): string {
    return (
      `PGOPTIONS='-c statement_timeout=${STATEMENT_TIMEOUT_MS}' ` +
      `exec psql --single-transaction -v ON_ERROR_STOP=1 ` +
      `-U "$POSTGRES_USER" -d ${dbName} -f -`
    );
  }
}
