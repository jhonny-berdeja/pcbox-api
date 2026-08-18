# Secrets propios de `pcbox-api` para `POST /pcbox`

Este documento cubre los dos Secrets que la app `pcbox-api` necesita en su
propio namespace (`pcbox-api`) para que el endpoint `POST /pcbox`
funcione, además de la base `pcbox-db` (`infra-hub/databases/pcbox-db.md`). Se
asume que la app ya tiene su Deployment/Service desplegados vía el pipeline
de `infra-hub` (mismo mecanismo que `ticket-hub-api`, ver
`ticket-hub-api/README.md`) y que corren en el namespace `pcbox-api`.

## 0. Punto de partida

Conectarse al servidor por SSH sobre la IP de Tailscale (secret `SSH_HOST`,
`pcbox.bootstrap.md` paso 2):

```bash
ssh -i deploy_key jhon@IP_TAILSCALE
```

## 1. La clave SSH privada — `pcbox-ssh-key`

> **Esto no es un secret más.** El contenido de este Secret es una clave
> privada SSH que le da a la app `pcbox-api` acceso administrativo real al
> servidor `pcbox` — la misma clase de acceso que la clave `deploy_key`
> documentada en `pcbox.bootstrap.md` le da hoy a GitHub Actions. Cualquiera
> que pueda leer este Secret (o comprometer el Pod que lo monta) puede
> ejecutar comandos arbitrarios contra `pcbox` como el usuario
> `PCBOX_SSH_USER`. Tratarlo con el mismo cuidado que `deploy_key`:
> nunca commitearlo, nunca pegarlo en un log, y considerar generar un par
> de claves **separado** del `deploy_key` de CI (mismo usuario destino,
> clave distinta) para poder revocar el acceso de la app sin tocar el
> pipeline de CI, o viceversa.

Generar (o reutilizar) un par de claves y copiar la pública al servidor,
mismo procedimiento que `pcbox.bootstrap.md` paso 3:

```bash
ssh-keygen -t ed25519 -f ./pcbox_app_key -N ""
ssh-copy-id -i pcbox_app_key.pub jhon@IP_TAILSCALE
```

Crear el Secret a partir del archivo de la clave **privada** — no
`--from-literal`, para no tener que escapar los saltos de línea a mano:

```bash
microk8s kubectl create secret generic pcbox-ssh-key \
  -n pcbox-api \
  --from-file=pcbox_deploy_key=./pcbox_app_key
```

El nombre de la clave dentro del Secret (`pcbox_deploy_key`) importa: es el
nombre del archivo que termina montado en el Pod, y `AnsibleExecutionService`
tiene hardcodeado el path completo `/etc/ssh-keys/pcbox_deploy_key` (nunca
una env var — ver `.claude/CLAUDE.md`, sección "Variables de entorno").

En el manifiesto de Deployment de `pcbox-api` (repo `infra-hub`), montar
este Secret como **volumen de archivo**, no como `envFrom`:

```yaml
spec:
  containers:
    - name: pcbox-api
      volumeMounts:
        - name: ssh-key
          mountPath: /etc/ssh-keys
          readOnly: true
  volumes:
    - name: ssh-key
      secret:
        secretName: pcbox-ssh-key
        defaultMode: 0400
```

`defaultMode: 0400` deja el archivo montado de solo lectura para su dueño
únicamente — el mismo nivel de permiso que `ssh` exige de cualquier clave
privada que use directamente (rechaza claves con permisos más abiertos).

Borrar `pcbox_app_key`/`pcbox_app_key.pub` del disco local una vez creado
el Secret — no hace falta conservarlos fuera de Kubernetes.

## 2. Ya no hay un secreto propio de este endpoint

`pcbox-api-admin-credentials`/`ADMIN_API_KEY` no existen más:
`POST /pcbox` verifica al caller contra el JWKS de `auth-api`
(`JwtAuthGuard`/`RolesGuard`, rol `ADMIN`) en vez de un secreto
compartido — solo necesita `AUTH_API_URL` (env var plana, ver
`infra-hub/apps/pcbox-api/deployment.yaml`), no un Secret nuevo acá.
El caller (`ticket-hub-api`) tiene su propio Secret del lado de
`ticket-hub` — ver `infra-hub/databases/ticket-hub-db.md` §9.

## 3. Datos que quedan de este proceso

| Dato | Qué es | De qué paso salió | Para qué es |
|---|---|---|---|
| Secret `pcbox-ssh-key` (namespace `pcbox-api`, montado como archivo) | Clave privada SSH con acceso administrativo real a `pcbox` | Paso 1 | Autenticación de `AnsibleExecutionService` contra `pcbox` vía `ansible-playbook --private-key` |
