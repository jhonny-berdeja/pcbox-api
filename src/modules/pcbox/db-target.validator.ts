import { BadRequestException } from '@nestjs/common';
import { findAllowedDbTarget } from './value-objects/db-target.allowlist';

const NOT_ALLOWED_MESSAGE =
  'Target {namespace, deployment, dbName} is not in the allowlist';

export class DbTargetValidator {
  /** Throws `BadRequestException` unless the exact triple matches an allowlisted `DbTarget`. */
  static assertAllowed(
    namespace: string,
    deployment: string,
    dbName: string,
  ): void {
    const target = findAllowedDbTarget(namespace, deployment, dbName);
    if (!target) {
      throw new BadRequestException(NOT_ALLOWED_MESSAGE);
    }
  }
}
