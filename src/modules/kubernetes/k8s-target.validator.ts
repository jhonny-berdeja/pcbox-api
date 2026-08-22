import { BadRequestException } from '@nestjs/common';
import { ALLOWED_K8S_NAMESPACES } from './value-objects/k8s-namespace.allowlist';

const NOT_ALLOWED_NAMESPACE_MESSAGE = 'namespace is not in the allowlist';
const NOT_ALLOWED_KIND_MESSAGE =
  'kind is a cluster-scoped/high-privilege kind and is not allowed';

/**
 * Cluster-scoped or high-privilege kinds pcbox-api will never apply on
 * behalf of a KUBERNETES ticket, regardless of namespace — a namespace
 * allowlist alone can't gate these since they either aren't
 * namespace-scoped at all (`Node`, `PersistentVolume`,
 * `CustomResourceDefinition`, the two webhook configuration kinds) or grant
 * cluster-wide privilege (`ClusterRole`, `ClusterRoleBinding`) or could be
 * used to escape the namespace allowlist entirely (`Namespace` itself).
 * Everything else — namespace-scoped workload kinds like `Deployment`,
 * `Service`, `ConfigMap`, `Secret`, `Pod`, `Job`, `CronJob`, `Ingress`,
 * `PersistentVolumeClaim`, `StatefulSet`, `DaemonSet`, `ServiceAccount`,
 * `Role`, `RoleBinding`, ... — is allowed.
 */
const BLOCKED_K8S_KINDS: readonly string[] = [
  'Namespace',
  'ClusterRole',
  'ClusterRoleBinding',
  'Node',
  'CustomResourceDefinition',
  'PersistentVolume',
  'ValidatingWebhookConfiguration',
  'MutatingWebhookConfiguration',
];

export class K8sTargetValidator {
  /** Throws `BadRequestException` unless `namespace` is allowlisted. */
  static assertAllowedNamespace(namespace: string): void {
    if (!ALLOWED_K8S_NAMESPACES.includes(namespace)) {
      throw new BadRequestException(NOT_ALLOWED_NAMESPACE_MESSAGE);
    }
  }

  /** Throws `BadRequestException` if `kind` is a blocked cluster-scoped/high-privilege kind. */
  static assertAllowedKind(kind: string): void {
    if (BLOCKED_K8S_KINDS.includes(kind)) {
      throw new BadRequestException(NOT_ALLOWED_KIND_MESSAGE);
    }
  }
}
