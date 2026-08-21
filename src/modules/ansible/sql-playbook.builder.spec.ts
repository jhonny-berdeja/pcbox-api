import { load } from 'js-yaml';
import { SqlPlaybookBuilder } from './sql-playbook.builder';
import { DbTarget } from '../database/value-objects/db-target.allowlist';

const TARGET: DbTarget = {
  namespace: 'databases',
  deployment: 'postgres',
  dbName: 'ticket-hub',
};

const METACHARACTER_CORPUS: string[] = [
  "SELECT * FROM users WHERE name = 'O''Brien';",
  'SELECT * FROM "orders";',
  'UPDATE t SET x = 1; DROP TABLE t;',
  'SELECT $(id) FROM nowhere;',
  'SELECT `backtick_col` FROM t;',
  'SELECT 1;\nSELECT 2;\n-- comment',
  '---\nSELECT 1;',
];

interface ParsedCommandTask {
  'ansible.builtin.command': {
    argv: string[];
    stdin: string;
  };
}

interface ParsedPlay {
  tasks: unknown[];
}

function parsePlaybook(yaml: string): ParsedPlay[] {
  return load(yaml) as ParsedPlay[];
}

describe('SqlPlaybookBuilder', () => {
  it.each(METACHARACTER_CORPUS)(
    'delivers SQL containing metacharacters only via stdin, byte-identical, and never inside argv (%s)',
    (sqlCode) => {
      const yaml = SqlPlaybookBuilder.build(TARGET, sqlCode);
      const plays = parsePlaybook(yaml);

      const commandTask = plays[0].tasks[0] as ParsedCommandTask;
      const command = commandTask['ansible.builtin.command'];

      expect(command.stdin).toBe(sqlCode);
      expect(command.argv.some((arg) => arg.includes(sqlCode))).toBe(false);
    },
  );

  it('keeps exactly one play even when sqlCode contains a YAML play-injection payload', () => {
    const injection = 'SELECT 1;\n- hosts: localhost\n  tasks: []';
    const yaml = SqlPlaybookBuilder.build(TARGET, injection);
    const plays = parsePlaybook(yaml);

    expect(plays).toHaveLength(1);
    const commandTask = plays[0].tasks[0] as ParsedCommandTask;
    expect(commandTask['ansible.builtin.command'].stdin).toBe(injection);
  });
});
