# pcbox-api

## ¿Para qué es este proyecto?

`pcbox-api` es el servicio del ecosistema `jtagram` encargado de ejecutar, de forma controlada y auditable, tareas administrativas sobre el servidor físico `pcbox`. Expone un único endpoint que recibe un playbook de Ansible junto con los datos de un ticket ya aprobado, deja registro de esa administración en base de datos y corre el playbook contra `pcbox` real por SSH, devolviendo el resultado de la ejecución.

## ¿Qué hace cada módulo?

### `ansible`

Se encarga de correr playbooks de Ansible contra el servidor `pcbox`. `AnsibleValidator` verifica que el `fileContent` recibido sea YAML válido antes de intentar ejecutarlo. `AnsibleConnector` vuelca ese contenido a un archivo temporal y lo ejecuta con el binario `ansible-playbook`, autenticándose por SSH con una clave privada montada en el Pod en un path fijo (`/etc/ssh-keys/pcbox_deploy_key`) y usando `PCBOX_SSH_HOST`/`PCBOX_SSH_USER` como destino y usuario. `AnsibleService` orquesta la validación y la ejecución, y además loguea el resultado completo (éxito, código de salida, stdout y stderr) para que quede trazado en la observabilidad del clúster.

### `auth`

Protege el endpoint de `pcbox` verificando quién llama. `JwksClientService` consulta periódicamente (cada 5 minutos) el JWKS publicado por `auth-api` y mantiene en memoria las claves públicas necesarias para validar tokens RS256. `JwtAuthGuard` toma el bearer token de cada request, identifica con qué clave (`kid`) fue firmado y valida su firma y vigencia contra esas claves cacheadas. `RolesGuard`, combinado con el decorador `@Roles`, exige que el usuario autenticado tenga el rol `ADMIN` para poder ejecutar la operación.

### `pcbox`

Es el módulo de negocio: expone `POST /pcbox`, protegido por `JwtAuthGuard` y `RolesGuard` (rol `ADMIN`). `CreatePcboxDto` valida la metadata del ticket (`ticketNumber`, `department`, `approver`, `informer`, `status`) y el `fileContent` del playbook. `PcboxService` rechaza cualquier solicitud cuyo `status` no sea `APPROVED`, valida que el `fileContent` sea YAML válido, guarda el registro de la administración en la tabla `administrations` y por último dispara la ejecución real del playbook a través del módulo `ansible`, devolviendo tanto los datos guardados como el resultado de la ejecución.

## ¿Qué variables de entorno necesito?

### Variables para el pipeline de GitHub Actions

El workflow `.github/workflows/release-pcbox-api.yml` necesita tres secretos de repositorio, documentados paso a paso en `.github/workflows/obtain-secrets.md`:

- **`DOCKERHUB_USERNAME` y `DOCKERHUB_TOKEN`**: se usan juntos para autenticarse en Docker Hub, tanto al publicar la imagen de `pcbox-api` como al borrar tags viejos al final del release. `DOCKERHUB_USERNAME` es el usuario u organización de Docker Hub donde se publica la imagen; `DOCKERHUB_TOKEN` es un Access Token generado desde Docker Hub (Account Settings > Security) con permisos de **Read, Write, Delete**, porque el job de limpieza necesita poder borrar tags.
- **`INFRA_HUB_DISPATCH_TOKEN`**: token de acceso personal (fine-grained) de GitHub usado como `GH_TOKEN` para disparar el workflow de deploy en el repo `infra-hub` y luego consultar el estado de esa corrida. Se genera con acceso restringido al repositorio `infra-hub` y permisos `Actions: Read and write` + `Contents: Read-only`.

### Variables para el funcionamiento de la app

Definidas y validadas en `src/common/config/env.validation.ts`. La app corre solo como Pod en el namespace `pcbox-api` de microk8s: no hay `.env` local ni entorno de desarrollo con Postgres propio — todos estos valores llegan como variables de entorno inyectadas por el manifiesto de Deployment (repo `infra-hub`), y si falta alguna la app no arranca.

- **`POSTGRES_USER` y `POSTGRES_PASSWORD`**: credenciales para conectarse a `pcbox-db`. Se obtienen del Secret que crea el proceso de base de datos documentado en `infra-hub/databases/pcbox-db.md` y llegan al Pod vía `envFrom: secretRef`.
- **`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`**: datos de conexión a `pcbox-db` (DNS del Service, puerto y nombre de la base). Son valores literales fijos del manifiesto de Deployment, no secretos.
- **`PORT`**: puerto HTTP en el que escucha la app dentro del Pod. Valor literal fijo del manifiesto.
- **`LOG_LEVEL`**: nivel mínimo de log de pino (`trace`/`debug`/`info`/`warn`/`error`/`fatal`). Valor literal fijo del manifiesto.
- **`AUTH_API_URL`**: URL base in-cluster de `auth-api` (por ejemplo `http://auth-api.auth-api.svc.cluster.local:3000`), que `JwksClientService` usa para obtener el JWKS con el que se validan los tokens de cada request. Valor literal fijo del manifiesto, ver `documentation/pcbox.pcbox-deploy.md`.
- **`PCBOX_SSH_HOST` y `PCBOX_SSH_USER`**: host y usuario SSH del servidor `pcbox` real contra el que se ejecutan los playbooks. Son el mismo host y usuario que los secretos `SSH_HOST`/`SSH_USER` documentados en `documentation/pcbox.bootstrap.md` para el acceso de CI, ahora también consumidos por esta app.

Además, la clave privada SSH que usa `AnsibleConnector` para autenticarse contra `pcbox` **no** es una variable de entorno: se monta como archivo desde el Secret `pcbox-ssh-key` en el path fijo `/etc/ssh-keys/pcbox_deploy_key`. El procedimiento completo para generarla y montarla está en `documentation/pcbox.pcbox-deploy.md`.

## ¿Cómo se ejecuta la app?

La app no se corre en local: vive desplegada como Pod en el microk8s del servidor `pcbox`. Para desplegar una nueva versión hay que ir al workflow de GitHub Actions `Release pcbox-api` (`.github/workflows/release-pcbox-api.yml`) y dispararlo manualmente (`workflow_dispatch`), completando dos inputs:

- **`previous_stable_tag`** (tag anterior estable): el tag que se mantiene como la última versión estable conocida. El workflow valida que ese tag ya exista como tag de git y como tag de imagen en Docker Hub, y al final del proceso lo conserva mientras borra el resto de los tags viejos.
- **`new_tag`** (tag nuevo a liberar): la versión nueva que se va a construir, publicar y desplegar. El workflow valida que ese tag todavía no exista ni en git ni en Docker Hub.

A partir de ahí, el pipeline hace todo el proceso: valida secretos y tags, construye y publica la imagen `pcbox-api:<new_tag>` en Docker Hub, crea el tag de git correspondiente y, usando `INFRA_HUB_DISPATCH_TOKEN`, dispara el workflow `deploy-pcbox-api.yml` del repo `infra-hub` — que es el que efectivamente aplica el nuevo manifiesto y despliega la imagen en el microk8s de `pcbox`. El job de release espera a que esa corrida en `infra-hub` termine antes de continuar. Por último, borra de Docker Hub todos los tags de `pcbox-api` excepto `previous_stable_tag` y `new_tag`, dejando el repositorio de imágenes limpio.

## ¿Cómo configuro un servidor nuevo desde cero?

Todo lo anterior asume un servidor `pcbox` ya preparado. Para dejar un servidor nuevo listo desde cero hay que resolver, en este orden, los tres instructivos de [`documentation/`](documentation):

1. [`pcbox.bootstrap.md`](documentation/pcbox.bootstrap.md) — configuración inicial del servidor a mano (Ubuntu Server, OpenSSH, Tailscale, clave SSH sin contraseña, sudo sin contraseña).
2. [`pcbox.microk8s-setup.md`](documentation/pcbox.microk8s-setup.md) — instalación de microk8s, extensión del certificado del API server para Tailscale, generación del kubeconfig remoto y habilitación del Dashboard.
3. [`pcbox.pcbox-deploy.md`](documentation/pcbox.pcbox-deploy.md) — Secrets propios de `pcbox-api` que necesita la app para el endpoint `POST /pcbox`.
