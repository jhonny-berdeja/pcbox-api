# pcbox-api

Este proyecto es para todo lo que tiene que ver con la gestión del servidor `pcbox` — el servidor que usa todo el ecosistema `jtagram`.

## Cómo montar el ecosistema

Para dejar el servidor listo, seguir los documentos de `documentation/` **en este orden**:

1. [`documentation/pcbox.bootstrap.md`](./documentation/pcbox.bootstrap.md) — configuración inicial del servidor (Ubuntu Server, SSH, Tailscale, sudo sin contraseña).
2. [`documentation/pcbox.microk8s-setup.md`](./documentation/pcbox.microk8s-setup.md) — instalación de microk8s, certificado del API server para Tailscale, kubeconfig, y el Dashboard.
3. [`infra-hub/databases/ticket-hub-db.md`](../infra-hub/databases/ticket-hub-db.md) — deploy de la base de datos `ticket-hub-db` en microk8s.
4. [`documentation/pcbox.grafana-deploy.md`](./documentation/pcbox.grafana-deploy.md) — deploy de Grafana en microk8s.
5. [`documentation/pcbox.loki-deploy.md`](./documentation/pcbox.loki-deploy.md) — deploy de Loki/Promtail en microk8s.
6. [`infra-hub/databases/pcbox-db.md`](../infra-hub/databases/pcbox-db.md) — deploy de la base de datos `pcbox-db` (tabla `administrations`) en microk8s, namespace `pcbox-api`.
7. [`documentation/pcbox.administrations-deploy.md`](./documentation/pcbox.pcbox-deploy.md) — el Secret de la clave SSH que esta app usa para administrar `pcbox` de verdad, y el resto de env vars/Secrets propios de esta app.

Después de eso, hay que clonar y deployar `ticket-hub` y `ticket-hub-api` — cada uno tiene su propia documentación, dentro de su propio repo, para hacerlo.

Con eso, el ecosistema ya queda montado. Lo único que va quedando pendiente de ahí en adelante es clonar y deployar los distintos proyectos de `jtagram` a medida que se necesiten — incluyendo este mismo repo, `pcbox-api`.

## Qué hace esta app

Un único endpoint, `POST /pcbox`: recibe un playbook de Ansible (YAML) más metadata de un ticket, y si el `status` es `APPROVED` y el YAML parsea, guarda el registro en la tabla `administrations` y ejecuta el playbook contra el servidor `pcbox` real por SSH. La metadata del ticket (`ticketNumber`/`department`/`approver`/`informer`) se guarda tal cual se recibe — ya no se valida contra `ticket-hub-api`. Ver `.claude/CLAUDE.md` para la arquitectura completa.

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
| `AUTH_API_URL` | Yes | literal `env:` → `http://auth-api.auth-api.svc.cluster.local:3000` | Base URL of auth-api, polled every 5 min for its JWKS (`JwksClientService`) — the RS256 key every request's bearer token is verified against |
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
for e2e) and mocked `execFile` (see
`src/modules/pcbox/*.spec.ts` and
`test/modules/pcbox/pcbox.e2e-spec.ts`), never a real
Postgres or SSH connection — by design, this environment
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

### 2. Exercise `POST /pcbox`

No ticket lookup happens anymore — any `ticketNumber`/`department`/
`approver`/`informer` combination is accepted and saved as-is, as long as
`status` is `'APPROVED'` and `fileContent` parses as YAML.

```bash
microk8s kubectl port-forward -n pcbox-api svc/pcbox-api 3000:3000
```

This app verifies callers against auth-api's JWKS now (see
`src/modules/auth/`) -- getting a real bearer token means logging in
through auth-api first as the `pcbox-api` apps-user (`POST
/apps-users/login`), not something this repo can do standalone:

```bash
curl -i -X POST http://localhost:3000/pcbox \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token from auth-api>' \
  -d '{
    "ticketNumber": 1,
    "department": "Datacenter",
    "approver": "Beto",
    "informer": "ana@example.com",
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

- Missing/invalid/expired bearer token, or a token without ADMIN → `401`/`403`.
- `status` other than `APPROVED` → `400`, nothing saved.
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
