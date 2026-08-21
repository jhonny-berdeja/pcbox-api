import { BadRequestException } from '@nestjs/common';
import { DbTargetValidator } from './db-target.validator';

describe('DbTargetValidator', () => {
  it.each([
    ['unlisted namespace', 'unknown-ns', 'postgres', 'ticket-hub'],
    ['unlisted deployment', 'databases', 'unknown-deploy', 'ticket-hub'],
    ['unlisted dbName', 'databases', 'postgres', 'unknown-db'],
    [
      'stale pre-consolidation dbName (real target renamed away from this)',
      'databases',
      'postgres',
      'ticket-hub-db',
    ],
  ])(
    'rejects an off-allowlist target (%s) with a BadRequestException',
    (_label, namespace, deployment, dbName) => {
      expect(() =>
        DbTargetValidator.assertAllowed(namespace, deployment, dbName),
      ).toThrow(BadRequestException);
    },
  );

  it('accepts an exact allowlisted triple without throwing', () => {
    expect(() =>
      DbTargetValidator.assertAllowed('databases', 'postgres', 'pcbox'),
    ).not.toThrow();
  });
});
