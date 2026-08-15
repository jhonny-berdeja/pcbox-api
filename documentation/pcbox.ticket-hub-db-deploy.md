# Deploy de la base de datos `ticket-hub-db` en microk8s (servidor pcbox)

Motor elegido: **PostgreSQL**. Corre como un Pod dentro del cluster de microk8s (no instalado directo en el sistema operativo del servidor), con sus datos en un volumen persistente y sus credenciales en un Secret de Kubernetes — el mismo tipo de recurso que ya se gestiona desde el Dashboard (`pcbox.microk8s-setup.md`, paso 3). Así, cambiar el usuario o la contraseña de la base más adelante es editar ese Secret desde la interfaz, sin tocar nada en el servidor a mano.

## 0. Punto de partida

Todo este instructivo asume que ya se completó `pcbox.bootstrap.md` (pasos 1 a 4) y `pcbox.microk8s-setup.md` entero — microk8s tiene que estar instalado y corriendo. Conectarse al servidor por SSH sobre la IP de Tailscale (secret `SSH_HOST`, `pcbox.bootstrap.md` paso 2):

```bash
ssh -i deploy_key jhon@IP_TAILSCALE
```

Todos los comandos de este documento se corren desde esa sesión.

## 1. Habilitar almacenamiento persistente en microk8s

Por defecto microk8s no tiene una `StorageClass` para que los Pods pidan volúmenes persistentes. Habilitar el addon:

```bash
microk8s enable hostpath-storage
```

Esto crea la `StorageClass` `microk8s-hostpath`, que guarda los datos en disco en el propio servidor — sobreviven a que el Pod se reinicie o se recree.

## 2. Crear el namespace

Para no mezclar estos recursos con los del Dashboard (que vive en `kube-system`):

```bash
microk8s kubectl create namespace ticket-hub
```

## 3. Crear el Secret con el usuario y la contraseña

Este es el Secret que después se edita desde el Dashboard (`pcbox.microk8s-setup.md`, paso 3 → Secrets → ícono de "ojo" para revelar, o el botón de editar) cada vez que haga falta rotar la credencial. Reemplazar `usuario_db` y `clave_segura` por los valores reales:

```bash
microk8s kubectl create secret generic ticket-hub-db-credentials \
  -n ticket-hub \
  --from-literal=POSTGRES_USER=usuario_db \
  --from-literal=POSTGRES_PASSWORD=clave_segura
```

> **Nota:** esta es la única vez que la credencial se escribe a mano por línea de comandos. De acá en adelante, para cambiarla, se hace desde el Dashboard — el Pod de la base la relee recién en el próximo reinicio del Pod, porque Kubernetes no reinyecta variables de entorno en un contenedor ya corriendo.

## 4. Definir el esquema inicial como ConfigMap

En vez de crear las tablas a mano por `psql` cada vez, el esquema se guarda como script SQL en un ConfigMap. La imagen oficial de Postgres ejecuta automáticamente cualquier `.sql` que encuentre en `/docker-entrypoint-initdb.d/` la primera vez que arranca con el volumen de datos vacío.

```bash
sudo nano ~/ticket-hub-db-init.yaml
```

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ticket-hub-db-init
  namespace: ticket-hub
data:
  init.sql: |
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(15) NOT NULL,
      lastname VARCHAR(15) NOT NULL,
      email VARCHAR(30) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL
    );

    CREATE TABLE roles (
      id SERIAL PRIMARY KEY,
      id_user INTEGER NOT NULL REFERENCES users(id),
      rol VARCHAR(15) NOT NULL
    );

    CREATE TABLE tickets (
      id SERIAL PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      creator INTEGER NOT NULL REFERENCES users(id),
      assignee INTEGER REFERENCES users(id),
      department VARCHAR(25) NOT NULL,
      subject VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL,
      description VARCHAR(200) NOT NULL,
      code_ansible VARCHAR(500)
    );
```

```bash
microk8s kubectl apply -f ~/ticket-hub-db-init.yaml
```

> **Nota sobre los agregados al esquema pedido:** se suman `REFERENCES` (foreign keys) en `roles.id_user`, `tickets.creator` y `tickets.assignee` porque apuntan a filas de `users` — sin esa referencia, Postgres dejaría insertar un `id_user` que no existe. `tickets.assignee` queda sin `NOT NULL` en el schema (la app lo exige igual al crear un ticket, por regla de negocio, no por constraint de DB — así no hace falta tocar filas existentes si esa regla cambia más adelante); el resto de las columnas obligatorias del pedido quedan como `NOT NULL`, y `email` suma `UNIQUE` porque es el dato que va a identificar al usuario para loguearse. `tickets.number` es `INTEGER NOT NULL UNIQUE`, no `SERIAL`: la app lo calcula ella misma (`MAX(number) + 1` antes de cada insert), no la base — un `SERIAL` en una columna que no es la primary key necesita `AUTOINCREMENT` al sincronizar el schema en SQLite (usado en los tests e2e), y SQLite solo permite `AUTOINCREMENT` en la primary key, así que no puede funcionar igual en los dos motores. La app le antepone el prefijo `TK-` (`TK-1`, `TK-2`, ...) solo para mostrarlo, nunca se guarda el prefijo en la columna.
>
> **Actualización posterior:** `tickets.number` se agregó después de que esta tabla ya estaba desplegada — si estás mirando este documento para levantar la base desde cero, ya viene incluido arriba. Si en cambio ya tenés una base viva sin esa columna, no se puede recrear la tabla sin perder datos; hay que agregarla con `ALTER TABLE`, ver el paso 7 más abajo.

## 5. Crear el volumen persistente, el Deployment y el Service

```bash
sudo nano ~/ticket-hub-db.yaml
```

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ticket-hub-db-pvc
  namespace: ticket-hub
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: microk8s-hostpath
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticket-hub-db
  namespace: ticket-hub
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: ticket-hub-db
  template:
    metadata:
      labels:
        app: ticket-hub-db
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: ticket-hub-db
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          envFrom:
            - secretRef:
                name: ticket-hub-db-credentials
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
            - name: init-script
              mountPath: /docker-entrypoint-initdb.d
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: ticket-hub-db-pvc
        - name: init-script
          configMap:
            name: ticket-hub-db-init
---
apiVersion: v1
kind: Service
metadata:
  name: ticket-hub-db
  namespace: ticket-hub
spec:
  selector:
    app: ticket-hub-db
  ports:
    - port: 5432
      targetPort: 5432
```

> **Nota sobre `PGDATA`:** apunta a un subdirectorio (`/pgdata`) y no directo a la raíz del volumen montado. Es el workaround conocido para Postgres sobre almacenamiento tipo hostPath — la raíz del volumen viene con un `lost+found` creado por el filesystem, y Postgres se niega a inicializar un directorio de datos que no está completamente vacío.

```bash
microk8s kubectl apply -f ~/ticket-hub-db.yaml
```

## 6. Verificar

```bash
microk8s kubectl get pods -n ticket-hub
```

Debería aparecer `ticket-hub-db-...` en estado `Running`. Ver los logs de arranque (ahí se ve si corrió el `init.sql`):

```bash
microk8s kubectl logs -n ticket-hub deployment/ticket-hub-db
```

Confirmar que las tres tablas quedaron creadas, entrando al Pod y usando `psql`:

```bash
microk8s kubectl exec -it -n ticket-hub deployment/ticket-hub-db -- psql -U usuario_db -d ticket-hub-db -c '\dt'
```

Debería listar `users`, `roles` y `tickets`.

Dentro del cluster, cualquier otro Pod (por ejemplo, más adelante, el propio `pcbox-api`) se conecta a esta base con el host `ticket-hub-db.ticket-hub.svc.cluster.local`, puerto `5432`, usando el usuario y la contraseña del Secret `ticket-hub-db-credentials`.

## 7. Agregar la columna `tickets.number` (migración posterior)

Esta columna se agregó al esquema después de que la base ya estaba desplegada — el `init.sql` del paso 4 no vuelve a correr sobre un volumen que ya tiene datos, así que hay que aplicarla a mano, una sola vez, con `ALTER TABLE`. Conectado por SSH al servidor:

```bash
microk8s kubectl exec -it -n ticket-hub deployment/ticket-hub-db -- bash
```

Ya adentro del contenedor:

```bash
psql -U "$POSTGRES_USER" -d ticket-hub-db
```

Y en el prompt de `psql`:

```sql
ALTER TABLE tickets ADD COLUMN number INTEGER;
UPDATE tickets SET number = id WHERE number IS NULL;
ALTER TABLE tickets ALTER COLUMN number SET NOT NULL;
ALTER TABLE tickets ADD CONSTRAINT tickets_number_unique UNIQUE (number);
```

No es `SERIAL` — la app calcula el número ella misma (`MAX(number) + 1` antes de cada insert, ver `TicketsService.create`), no la base. Por eso son cuatro pasos en vez de uno: `ADD COLUMN` sin `NOT NULL` primero (si la tabla ya tiene filas, Postgres no deja agregar una columna `NOT NULL` sin default de una sola vez), `UPDATE` para rellenar cualquier fila existente usando su propio `id` como número de partida razonable, y recién ahí `SET NOT NULL` + el `UNIQUE`. Si la tabla está vacía (lo más probable, ya que el flujo de creación de tickets recién se implementó), el `UPDATE` simplemente no actualiza nada y el resto corre igual. La app antepone `TK-` solo para mostrarlo (`TK-1`, `TK-2`, ...); la columna guarda el entero pelado.

Verificar:

```sql
\d tickets
```

Debería listar `number` como `integer`, `not null`, con una constraint `UNIQUE`.

## 8. Agregar la columna `tickets.response` (migración posterior)

Igual que en el paso anterior, `tickets` ya está desplegada, así que esta
columna nueva se aplica a mano con `ALTER TABLE` — pero más simple que
`number`, porque `response` es `nullable`: no hace falta backfill ni
`SET NOT NULL`. Conectado al contenedor y a `psql` igual que en el paso 7:

```sql
ALTER TABLE tickets ADD COLUMN response VARCHAR(600);
```

`response` guarda el resumen que devuelve `pcbox-api` (o una descripción
de la falla) cuando `ApproveTicketService` la llama justo después de
aprobar un ticket — nunca el stdout/stderr completo, ver
`ticket-hub-api/.claude/CLAUDE.md`. Queda `NULL` para cualquier ticket
que todavía no pasó por ese flujo (los ya creados antes de esta
migración, y cualquiera en estado `CREATED`).

Verificar:

```sql
\d tickets
```

Debería listar `response` como `character varying(600)`, sin `not null`.

## 9. El secreto para que `ticket-hub-api` le hable a `pcbox-api` — `pcbox-api-notification-credentials`

Mismo mecanismo que ya existió del lado de `pcbox-api` cuando llamaba a
ticket-hub-api (ver git history de `pcbox.administrations-deploy.md` si
hace falta el precedente) pero en la dirección contraria: ahora
`ticket-hub-api` es quien llama, a `POST /pcbox`, con el secreto
compartido que pcbox-api ya exige vía `AdminApiKeyGuard`
(`x-admin-api-key`/`ADMIN_API_KEY`, ver `pcbox.administrations-deploy.md`,
paso 2) — no una cuenta ni un login, ambos lados solo necesitan el mismo
valor.

```bash
microk8s kubectl create secret generic pcbox-api-notification-credentials \
  -n ticket-hub \
  --from-literal=PCBOX_API_ADMIN_KEY=<mismo valor que ADMIN_API_KEY de pcbox-api>
```

Si `ADMIN_API_KEY` se rota más adelante del lado de `pcbox-api`, este
Secret tiene que actualizarse al mismo valor en el mismo momento — no hay
ningún mecanismo automático que los mantenga sincronizados.

## 10. Datos que quedan de este proceso

| Dato | Qué es | De qué paso salió | Para qué es |
|---|---|---|---|
| Secret `ticket-hub-db-credentials` (namespace `ticket-hub`) | `POSTGRES_USER` y `POSTGRES_PASSWORD` de la base `ticket-hub-db` | Paso 3 (creado por `kubectl create secret`, editable después desde el Dashboard) | Credenciales de conexión a la base; cualquier rotación se hace editando este Secret desde el Dashboard, no por SSH |
| Host interno `ticket-hub-db.ticket-hub.svc.cluster.local:5432` | DNS interno del cluster que apunta al Service de la base | Paso 5 (`Service` `ticket-hub-db`) | Cadena de conexión que va a usar `pcbox-api` (u otro Pod del cluster) para hablarle a Postgres |
| Secret `pcbox-api-notification-credentials` (namespace `ticket-hub`) | `PCBOX_API_ADMIN_KEY` — mismo valor que `ADMIN_API_KEY` de pcbox-api | Paso 9 | `PcboxApiConnector` (en `ticket-hub-api`) manda este valor como `x-admin-api-key` al llamar `POST /pcbox` |
