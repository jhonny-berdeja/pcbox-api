/**
 * Server-owned allowlist of `{namespace, deployment, dbName}` triples
 * pcbox-api is allowed to `kubectl exec ... psql` into for a DATABASE
 * ticket. Independent of any client dropdown — the requester's choice is
 * only convenience; this const is the actual gate (see
 * `DbTargetValidator.assertAllowed`).
 *
 * All three entries share the same `namespace`/`deployment` now: a single
 * consolidated Postgres Pod (`postgres`, namespace `databases`) hosts the
 * three logical databases `iam`/`pcbox`/`ticket-hub` as of the cutover
 * documented in `infra-hub/databases/jtagram.db.md` — it replaced the
 * three separate per-app Pods (`ticket-hub-db`/`pcbox-db`/`auth-db`, each
 * in its own app's namespace) this allowlist pointed to before. Adding a
 * target here is a deliberate, reviewed deploy — not a runtime-editable
 * list.
 */
export interface DbTarget {
  namespace: string;
  deployment: string;
  dbName: string;
}

export const DB_TARGETS: readonly DbTarget[] = [
  { namespace: 'databases', deployment: 'postgres', dbName: 'ticket-hub' },
  { namespace: 'databases', deployment: 'postgres', dbName: 'pcbox' },
  { namespace: 'databases', deployment: 'postgres', dbName: 'iam' },
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
