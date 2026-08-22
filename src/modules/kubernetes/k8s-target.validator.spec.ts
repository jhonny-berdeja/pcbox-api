import { BadRequestException } from '@nestjs/common';
import { K8sTargetValidator } from './k8s-target.validator';

describe('K8sTargetValidator.assertAllowedNamespace', () => {
  it.each([['unknown-ns'], ['default'], ['kube-system']])(
    'rejects an off-allowlist namespace (%s) with a BadRequestException',
    (namespace) => {
      expect(() =>
        K8sTargetValidator.assertAllowedNamespace(namespace),
      ).toThrow(BadRequestException);
    },
  );

  it.each([
    ['pcbox-api'],
    ['ticket-hub'],
    ['auth-api'],
    ['iam-api'],
    ['databases'],
  ])('accepts an allowlisted namespace (%s) without throwing', (namespace) => {
    expect(() =>
      K8sTargetValidator.assertAllowedNamespace(namespace),
    ).not.toThrow();
  });
});

describe('K8sTargetValidator.assertAllowedKind', () => {
  it.each([
    ['Namespace'],
    ['ClusterRole'],
    ['ClusterRoleBinding'],
    ['Node'],
    ['CustomResourceDefinition'],
    ['PersistentVolume'],
    ['ValidatingWebhookConfiguration'],
    ['MutatingWebhookConfiguration'],
  ])('rejects the blocked kind %s with a BadRequestException', (kind) => {
    expect(() => K8sTargetValidator.assertAllowedKind(kind)).toThrow(
      BadRequestException,
    );
  });

  it.each([
    ['Deployment'],
    ['Service'],
    ['ConfigMap'],
    ['Secret'],
    ['Pod'],
    ['Job'],
    ['CronJob'],
    ['Ingress'],
    ['PersistentVolumeClaim'],
    ['StatefulSet'],
    ['DaemonSet'],
    ['ServiceAccount'],
    ['Role'],
    ['RoleBinding'],
  ])('accepts a namespace-scoped kind %s without throwing', (kind) => {
    expect(() => K8sTargetValidator.assertAllowedKind(kind)).not.toThrow();
  });
});
