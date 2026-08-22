-- Adds `execution_type` to `kubernetes_register`.
--
-- Manual DDL — this repo has `synchronize: false` and no automated
-- migrations (see `src/common/database/database.module.ts`), so this file
-- is a reference to run by hand against the real database, not something
-- any tool applies automatically.
--
-- Backfills existing rows to 'MANIFEST' via the DEFAULT: every row written
-- before this column existed came from the k8s-manifest flow
-- (`KubernetesService.executeManifests`, `POST /kubernetes`) — the
-- Ansible/SSH flow (`KubernetesService.executeAnsiblePlaybook`,
-- `POST /kubernetes/ansible`) didn't exist yet, so 'ANSIBLE' never applies
-- retroactively.
ALTER TABLE kubernetes_register
  ADD COLUMN execution_type VARCHAR(10) NOT NULL DEFAULT 'MANIFEST';
