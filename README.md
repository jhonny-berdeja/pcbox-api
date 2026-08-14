# pcbox-api

Este proyecto es para todo lo que tiene que ver con la gestión del servidor `pcbox` — el servidor que usa todo el ecosistema `jtagram`.

## Cómo montar el ecosistema

Para dejar el servidor listo, seguir los documentos de `documentation/` **en este orden**:

1. [`documentation/pcbox.bootstrap.md`](./documentation/pcbox.bootstrap.md) — configuración inicial del servidor (Ubuntu Server, SSH, Tailscale, sudo sin contraseña).
2. [`documentation/pcbox.microk8s-setup.md`](./documentation/pcbox.microk8s-setup.md) — instalación de microk8s, certificado del API server para Tailscale, kubeconfig, y el Dashboard.
3. [`documentation/pcbox.ticket-hub-db-deploy.md`](./documentation/pcbox.ticket-hub-db-deploy.md) — deploy de la base de datos `ticket-hub-db` en microk8s.
4. [`documentation/pcbox.grafana-deploy.md`](./documentation/pcbox.grafana-deploy.md) — deploy de Grafana en microk8s.
5. [`documentation/pcbox.loki-deploy.md`](./documentation/pcbox.loki-deploy.md) — deploy de Loki/Promtail en microk8s.
6. [`documentation/pcbox.pcbox-db-deploy.md`](./documentation/pcbox.pcbox-db-deploy.md) — deploy de la base de datos `pcbox-db` (tabla `administrations`) en microk8s, namespace `pcbox-api`.
7. [`documentation/pcbox.administrations-deploy.md`](./documentation/pcbox.administrations-deploy.md) — el Secret de la clave SSH que esta app usa para administrar `pcbox` de verdad, y el resto de env vars/Secrets propios de esta app.

Después de eso, hay que clonar y deployar `ticket-hub` y `ticket-hub-api` — cada uno tiene su propia documentación, dentro de su propio repo, para hacerlo.

Con eso, el ecosistema ya queda montado. Lo único que va quedando pendiente de ahí en adelante es clonar y deployar los distintos proyectos de `jtagram` a medida que se necesiten — incluyendo este mismo repo, `pcbox-api`.

## Qué hace esta app

Un único endpoint, `POST /pcbox`: recibe un playbook de Ansible (YAML) más metadata de un ticket, valida ese ticket contra `ticket-hub-api`, y si todo matchea guarda el registro en la tabla `administrations` y ejecuta el playbook contra el servidor `pcbox` real por SSH. Ver `.claude/CLAUDE.md` para la arquitectura completa.

## Environment variables

This app runs **only** as a Pod in the microk8s `pcbox-api` namespace. There is
no local dev environment, no docker-compose Postgres, and no `.env` file —
every value below arrives as a container env var injected by the Deployment
manifest (`ConfigModule.forRoot({ ignoreEnvFile: true, validate })` fails fast
at boot if any is missing).

| Var | Required | Source (in-cluster) | Description |
|---|---|---|---|
| `POSTGRES_USER` | Yes | `envFrom: secretRef: pcbox-db-credentials` | Postgres role used to connect to `pcbox-db` |
| `POSTGRES_PASSWORD` | Yes | `envFrom: secretRef: pcbox-db-credentials` | Password for `POSTGRES_USER` |
| `DATABASE_HOST` | Yes | literal `env:` → `pcbox-db.pcbox-api.svc.cluster.local` | Postgres Service DNS name |
| `DATABASE_PORT` | Yes | literal `env:` → `5432` | Postgres port |
| `DATABASE_NAME` | Yes | literal `env:` → `pcbox-db` | Database name |
| `PORT` | Yes | literal `env:` → `3000` | HTTP port the Nest app listens on |
| `LOG_LEVEL` | Yes | literal `env:` → `info` | Minimum pino log level (`trace`/`debug`/`info`/`warn`/`error`/`fatal`) |
| `TICKET_HUB_API_URL` | Yes | literal `env:` → `http://ticket-hub-api.ticket-hub.svc.cluster.local:3000` | Base URL of ticket-hub-api, used to call `GET /tickets/:number/verify` |
| `TICKET_HUB_API_INTERNAL_KEY` | Yes | `secretRef: ticket-hub-verification-credentials` | Must hold the **same value** as ticket-hub-api's own `INTERNAL_API_KEY` — provisioned as a separate Secret here, Kubernetes Secrets don't cross namespaces |
| `ADMIN_API_KEY` | Yes | `secretRef: pcbox-api-admin-credentials` | Shared secret this app itself requires via `x-admin-api-key` on `POST /pcbox` |
| `PCBOX_SSH_HOST` | Yes | literal `env:` → same Tailscale IP as the `SSH_HOST` secret in `pcbox.bootstrap.md` | Host of the `pcbox` server the app SSHes into to run playbooks |
| `PCBOX_SSH_USER` | Yes | literal `env:` → same value as `SSH_USER` in `pcbox.bootstrap.md` | SSH user the app authenticates as |

The SSH **private key** itself is not an env var at all — it's mounted from a
Kubernetes Secret as a file at the fixed path `/etc/ssh-keys/pcbox_deploy_key`
(see `AnsibleService` and
`documentation/pcbox.administrations-deploy.md`). That key gives this app
real administrative SSH access to `pcbox` — treat it accordingly, never as a
routine config value.

## Manual verification (once deployed in-cluster)

Kubernetes Deployment/Service manifests for this app live in the separate
`infra-hub` repo, the same pattern as `ticket-hub-api` — not in this repo.
All automated tests here run against a mocked repository (in-memory SQLite
for e2e) and mocked `fetch`/`execFile` (see
`src/modules/pcbox/*.spec.ts` and
`test/modules/pcbox/pcbox.e2e-spec.ts`), never a real
Postgres, ticket-hub-api, or SSH connection — by design, this environment
cannot run `ansible-playbook` against a real server. The checklist below is
the only way to confirm the real playbook execution actually works, and it
needs `pcbox.administrations-deploy.md`'s Secret to already exist in-cluster.

### 1. Confirm the Pod is up

```bash
microk8s kubectl get pods -n pcbox-api
microk8s kubectl logs -n pcbox-api deployment/pcbox-api
```

Should show `Running`, with Nest's route map at boot (`Mapped
{/pcbox, POST}`) and no `Missing required environment variable(s)`
error.

### 2. Exercise `POST /pcbox` against a real, APPROVED ticket

Requires a ticket in `ticket-hub-db` with `status = 'APPROVED'` and a known
`department`/`creator`/`assignee` — create and approve one through
`ticket-hub`/`ticket-hub-api` first.

```bash
microk8s kubectl port-forward -n pcbox-api svc/pcbox-api 3000:3000
```

```bash
curl -i -X POST http://localhost:3000/pcbox \
  -H 'Content-Type: application/json' \
  -H 'x-admin-api-key: <ADMIN_API_KEY value>' \
  -d '{
    "ticketNumber": 1,
    "department": "Datacenter",
    "approver": "Beto",
    "informer": "Ana",
    "status": "APPROVED",
    "fileContent": "- hosts: all\n  tasks:\n    - name: ping\n      ansible.builtin.ping:\n"
  }'
```

Expected: `201 Created`, body includes `data.execution.success` and
`data.execution.exitCode`. Confirm the full stdout/stderr landed in Loki:

```
{namespace="pcbox-api", container="pcbox-api"} | json | msg="Ansible playbook execution against pcbox"
```

Confirm the row landed in `administrations`:

```bash
microk8s kubectl exec -it -n pcbox-api deployment/pcbox-db -- \
  psql -U "$POSTGRES_USER" -d pcbox-db -c "SELECT * FROM administrations;"
```

### 3. Confirm the failure paths

- Wrong/missing `x-admin-api-key` → `401`.
- `status` other than `APPROVED` → `400`, nothing saved, ticket-hub-api never called (confirm via Loki: no outbound request logged).
- A ticket number/department/status/informer/approver combination that ticket-hub-api doesn't confirm → `422`, nothing saved, `ansible-playbook` never invoked.
- Unparseable `fileContent` → `400`, nothing saved.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
