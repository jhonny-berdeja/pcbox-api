/**
 * Server-owned allowlist of Kubernetes namespaces pcbox-api is allowed to
 * apply manifests into for a KUBERNETES ticket. Independent of any client
 * dropdown — the requester's choice is only convenience; this const is the
 * actual gate (see `K8sTargetValidator.assertAllowedNamespace`).
 *
 * Mirrors the real namespaces already defined across each app's
 * `infra-hub/apps/<app>/namespace.yaml`, plus the `databases` namespace
 * from `../../database/value-objects/db-target.allowlist.ts` (the
 * consolidated Postgres namespace). Adding a namespace here is a
 * deliberate, reviewed deploy — not a runtime-editable list.
 */
export const ALLOWED_K8S_NAMESPACES: readonly string[] = [
  'pcbox-api',
  'ticket-hub',
  'auth-api',
  'iam-api',
  'databases',
];
