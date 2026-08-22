/**
 * Distinguishes which flow wrote a `kubernetes_register` row, now that two
 * different flows persist to that same table: the k8s API path
 * (`KubernetesService.executeManifests`, `POST /kubernetes`) and the
 * Ansible/SSH path (`KubernetesService.executeAnsiblePlaybook`,
 * `POST /kubernetes/ansible`). Never part of the HTTP contract — the client
 * never sends or receives it, `KubernetesMapper` stamps it based on which
 * route/mapper method ran, not on anything in `CreateKubernetesDto`.
 */
export enum ExecutionType {
  ANSIBLE = 'ANSIBLE',
  MANIFEST = 'MANIFEST',
}
