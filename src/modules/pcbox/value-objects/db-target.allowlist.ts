/**
 * Server-owned allowlist of `{namespace, deployment, dbName}` triples
 * pcbox-api is allowed to `kubectl exec ... psql` into for a DATABASE
 * ticket. Independent of any client dropdown — the requester's choice is
 * only convenience; this const is the actual gate (see
 * `DbTargetValidator.assertAllowed`).
 *
 * v1 entries mirror the deployments documented in
 * `infra-hub/databases/*.md`: `ticket-hub-db` (namespace `ticket-hub`),
 * `pcbox-db` (namespace `pcbox-api`, shared with the app's own
 * namespace), `auth-db` (namespace `auth-api`, same sharing pattern).
 * Adding a target here is a deliberate, reviewed deploy — not a
 * runtime-editable list.
 */
export interface DbTarget {
  namespace: string;
  deployment: string;
  dbName: string;
}

export const DB_TARGETS: readonly DbTarget[] = [
  {
    namespace: 'ticket-hub',
    deployment: 'ticket-hub-db',
    dbName: 'ticket-hub-db',
  },
  { namespace: 'pcbox-api', deployment: 'pcbox-db', dbName: 'pcbox-db' },
  { namespace: 'auth-api', deployment: 'auth-db', dbName: 'auth-db' },
];

/** Looks up an allowlisted target by exact triple match. Returns `undefined` if no entry matches. */
export function findAllowedDbTarget(
  namespace: string,
  deployment: string,
  dbName: string,
): DbTarget | undefined {
  return DB_TARGETS.find(
    (target) =>
      target.namespace === namespace &&
      target.deployment === deployment &&
      target.dbName === dbName,
  );
}
