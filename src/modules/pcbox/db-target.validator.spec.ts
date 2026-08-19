import { BadRequestException } from '@nestjs/common';
import { DbTargetValidator } from './db-target.validator';

describe('DbTargetValidator', () => {
  it.each([
    ['unlisted namespace', 'unknown-ns', 'ticket-hub-db', 'ticket-hub-db'],
    ['unlisted deployment', 'ticket-hub', 'unknown-deploy', 'ticket-hub-db'],
    ['unlisted dbName', 'ticket-hub', 'ticket-hub-db', 'unknown-db'],
    [
      'triple recombined across two real entries (partial match)',
      'ticket-hub',
      'auth-db',
      'auth-db',
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
      DbTargetValidator.assertAllowed('pcbox-api', 'pcbox-db', 'pcbox-db'),
    ).not.toThrow();
  });
});
