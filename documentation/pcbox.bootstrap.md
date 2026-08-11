# Bootstrap del servidor pcbox

Configuración inicial que se hizo a mano, una sola vez, en el servidor `pcbox` para dejarlo listo y que GitHub Actions pueda desplegar sobre él vía Ansible.

## 0. Instalación de Ubuntu Server

Configuración elegida durante el instalador de Ubuntu Server:

| Opción | Valor |
|---|---|
| Lenguaje | Español |
| Teclado | Inglés EEUU (Internacional con teclas muertas) |
| Tipo de instalación | Por defecto |
| Comunicación con otros equipos | Type eth |
| Proxy address | (vacío) |
| Disco | Kingston |
| Nombre | Jhonny Berdeja |
| Nombre del server | pcbox |
| Nombre de usuario | jhon |
| Contraseña | (ver nota abajo) |

Este usuario, `jhon`, es el que se usa en todos los pasos siguientes para conectarse por SSH — es el valor que va en el secret `SSH_USER`:

```
SSH_USER=jhon
```

> **Nota sobre la contraseña:** hay que guardarla para usarla en el paso 3 (copiar la clave pública con `ssh-copy-id`, que pide la contraseña una única vez) y en el paso 4 (entrar por SSH con contraseña antes de tener la clave configurada). Por seguridad, **no se guarda en texto plano en este documento ni en el repo** — guardarla en un gestor de contraseñas. Una vez configurada la clave SSH (paso 3) y el `sudo` sin contraseña (paso 4), esta contraseña deja de ser necesaria para el flujo automatizado.

## 1. Instalar OpenSSH en el Ubuntu Server

Como el servidor todavía no tiene SSH instalado, no se puede entrar por red — hay que conectarle un teclado y un monitor directamente, y conectarlo a internet (cable de red o WiFi, según lo que tenga disponible) para poder descargar el paquete.

Ya con acceso directo a la terminal del servidor:

```bash
sudo apt update
sudo apt install openssh-server -y
```

Verificar que el servicio esté corriendo:

```bash
sudo systemctl status ssh
```

Si no está activo:

```bash
sudo systemctl enable --now ssh
```

Obtener la IP local del servidor (la que se usa para conectarse por la red local, antes de tener Tailscale configurado):

```bash
ip addr show
```

o más simple:

```bash
hostname -I
```

Esta IP se usa para conectarse por SSH en los pasos siguientes (por ejemplo, para el `ssh-copy-id` del paso 3). **Guardarla**, la vamos a necesitar más adelante.

## 2. Instalar y configurar Tailscale

Con OpenSSH ya instalado (paso 1) y la IP local guardada, ya no hace falta teclado ni monitor — de acá en adelante se trabaja conectándose por SSH desde una PC cliente:

```bash
ssh jhon@IP_LOCAL_DEL_SERVIDOR
```

(pide la contraseña configurada en el paso 0). Ya conectado al servidor por SSH, instalar y configurar Tailscale, para autenticar al servidor en la red de Tailscale (así el runner de GitHub Actions lo puede alcanzar sin exponer el servidor a internet):

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

Luego iniciar sesión y conectar el equipo a la red Tailscale:

```bash
sudo tailscale up
```

Esto da un link para autenticarse con una cuenta (Google, Microsoft, GitHub, etc.). Se abre desde cualquier navegador (puede ser desde el celular) y se hace login ahí.

Una vez conectado el servidor a la tailnet, hay que obtener su IP de Tailscale (`100.x.x.x`). Para eso, conectarse a la tailnet desde una PC cliente (la propia compu, ya con Tailscale instalado y logueado con la misma cuenta) y correr:

```bash
tailscale status
```

Ahí va a aparecer el servidor `pcbox` listado junto a su IP `100.x.x.x`. También se puede ver desde la [consola web de Tailscale](https://login.tailscale.com/admin/machines). **Guardar esta IP**, es la que se va a usar como valor del secret `SSH_HOST` en GitHub Actions más adelante.

Para probar que la conexión funciona ahora por Tailscale (en vez de por la red local), desde la misma PC cliente:

```bash
ssh jhon@IP_TAILSCALE
```

Si conecta usando esa IP, Tailscale quedó bien configurado en el servidor.

## 3. Configurar una llave privada y pública para conectarse por SSH sin contraseña

Esta configuración se hace conectándose por SSH ya sobre la red de Tailscale, usando la IP `100.x.x.x` obtenida en el paso 2 (no hace falta estar en la misma red local que el servidor).

GitHub Actions no puede tipear una contraseña, así que necesita conectarse por clave SSH, no por password. Si hoy se entra con contraseña, hacer esto una sola vez, desde la PC cliente:

```bash
ssh-keygen -t ed25519 -f ./deploy_key -N ""
ssh-copy-id -i deploy_key.pub jhon@IP_TAILSCALE
```

(Si ya existe una clave que se usa para conectarse al servidor, se puede saltar el `ssh-keygen` y pasar directo al `ssh-copy-id` con esa clave.)

`jhon` es el usuario del servidor (paso 0) — es el valor del secret `SSH_USER`. `IP_TAILSCALE` es la IP obtenida en el paso 2 — es el valor del secret `SSH_HOST`.

Este comando genera dos archivos: `deploy_key` (la clave **privada**) y `deploy_key.pub` (la clave **pública**, que es la que se copia al servidor). La clave privada, `deploy_key`, es la que va a usar GitHub Actions para autenticarse por SSH sin contraseña — este archivo **no se sube al repo** (está en `.gitignore`).

Probar que la conexión funciona con la clave privada, sin que pida contraseña:

```bash
ssh -i deploy_key jhon@IP_TAILSCALE
```

Si conecta sin pedir password, la clave quedó bien configurada.

Para ver el contenido de la clave privada y poder usarla desde otro cliente — en este caso, para pegarla en el secret `SSH_PRIVATE_KEY` de GitHub Actions:

```bash
cat deploy_key
```

Copiar toda la salida, incluyendo las líneas `-----BEGIN...-----` y `-----END...-----`, y pegarla completa como valor del secret.

## 4. Configurar el usuario para que no tenga que escribir la contraseña de sudo

Ya que GitHub Actions no puede escribir la contraseña de forma interactiva.

Entrar al servidor con un usuario que tenga privilegios de admin (puede ser el mismo, si todavía deja loguearse y pedir la clave a mano):

```bash
ssh usuario@IP_TAILSCALE
```

Editar los sudoers de forma segura (mejor crear un archivo aparte en vez de tocar `/etc/sudoers` directo):

```bash
sudo visudo -f /etc/sudoers.d/github-deploy
```

Agregar esta línea (reemplazando `usuario` por el valor real del secret `SSH_USER`):

```
usuario ALL=(ALL) NOPASSWD:ALL
```

Guardar y salir. `visudo` valida la sintaxis automáticamente antes de guardar, así que si hay un error de tipeo avisa y no rompe nada.

Verificar sin salir de la sesión SSH (por si el paso anterior tuvo un error, no se pierde el acceso):

```bash
sudo -n true && echo "OK, no pide password"
```

## 5. Instalar microk8s

A diferencia de los pasos anteriores, esto se instala a mano y se mantiene fuera de Ansible/CI a propósito (no hay ningún playbook que lo instale ni lo gestione). Conectado por SSH sobre Tailscale:

```bash
sudo snap install microk8s --classic --channel=1.31/stable
```

Agregar al usuario `jhon` al grupo `microk8s` para no necesitar `sudo` en los comandos de `kubectl`:

```bash
sudo usermod -aG microk8s $USER
```

Esto no toma efecto en la sesión SSH actual hasta refrescar el grupo:

```bash
newgrp microk8s
```

(o cerrar y volver a entrar por SSH — cualquiera de las dos sirve).

Esperar a que el cluster esté listo (tarda un rato la primera vez, está bajando imágenes de containerd):

```bash
microk8s status --wait-ready
```

Verificar:

```bash
microk8s kubectl get nodes
```

Debería aparecer el nodo `pcbox` en estado `Ready`.

## 6. Extender el certificado del API server para Tailscale y preparar el kubeconfig para CI

Por defecto, el certificado que el API server de microk8s le muestra a quien se conecta solo es válido para la IP local del servidor — no para la IP de Tailscale (`100.x.x.x`, la misma ya guardada como secret `SSH_HOST` en el paso 2). Como el runner de GitHub Actions se conecta por Tailscale, hay que extender ese certificado para que también sea válido desde esa IP.

Editar la plantilla del certificado:

```bash
sudo nano /var/snap/microk8s/current/certs/csr.conf.template
```

En la sección `[alt_names]` va a haber algo como:

```ini
[alt_names]
DNS.1 = kubernetes
DNS.2 = kubernetes.default
DNS.3 = kubernetes.default.svc
DNS.4 = kubernetes.default.svc.cluster
DNS.5 = kubernetes.default.svc.cluster.local
IP.1 = 127.0.0.1
IP.2 = 10.152.183.1
IP.3 = 192.168.x.x   ← la IP local del servidor
```

**Sin reemplazar ninguna línea existente**, agregar una entrada nueva con el próximo número disponible (si la última es `IP.3`, la nueva es `IP.4`):

```ini
IP.4 = 100.x.x.x
```

con la IP de Tailscale del servidor. Guardar y salir, y regenerar el certificado del API server a partir de la plantilla actualizada (sin reiniciar todo el cluster):

```bash
sudo microk8s refresh-certs -e server.crt
```

> **Nota:** el flag es `-e`/`--cert`, no `-c` (`-c`/`--check` solo revisa vencimientos, no regenera nada — da un error de "Path does not exist" si se confunde).

Esperar a que se estabilice y verificar que la IP de Tailscale quedó en el certificado:

```bash
microk8s status --wait-ready
openssl x509 -in /var/snap/microk8s/current/certs/server.crt -noout -text | grep -A5 "Subject Alternative Name"
```

Generar el kubeconfig y editar el campo `server:` para que apunte a la IP de Tailscale en vez de a la IP local (la CA no cambia, el resto del archivo queda igual):

```bash
microk8s config > ~/pcbox-kubeconfig.yaml
nano ~/pcbox-kubeconfig.yaml
```

```yaml
server: https://100.x.x.x:16443   # IP de Tailscale, no la local
```

Sacar el archivo del servidor a la PC cliente (contiene una clave privada — es un secreto, no se commitea al repo):

```bash
scp jhon@IP_TAILSCALE:~/pcbox-kubeconfig.yaml .
```

## 7. Habilitar y acceder al Dashboard de microk8s

Conectarse al servidor y verificar que microk8s esté corriendo:

```bash
ssh -i deploy_key jhon@IP_TAILSCALE
microk8s status --wait-ready
```

Debería devolver `microk8s is running`.

Obtener la IP de Tailscale del servidor — es la misma que ya está guardada como secret `SSH_HOST` (paso 2), pero por si hace falta volver a consultarla desde la sesión SSH:

```bash
tailscale ip -4
```

**Guardarla** (formato `100.x.x.x`) — se usa más abajo, tanto en el servicio systemd como para acceder al Dashboard desde el navegador.

Habilitar el addon del Dashboard:

```bash
sudo microk8s enable dashboard
```

Verificar que los Pods estén corriendo (puede tardar 1-2 minutos):

```bash
microk8s kubectl get pods -n kube-system | grep dashboard
```

Todos deberían mostrar estado `Running`.

**Crear un servicio systemd para exponerlo de forma persistente** — reemplaza un port-forward manual (que muere si se cierra la sesión SSH) por un servicio que arranca solo, se reinicia si falla, y persiste después de reiniciar el servidor:

```bash
sudo nano /etc/systemd/system/dashboard-tunnel.service
```

Pegar el siguiente contenido, reemplazando `100.x.x.x` por la IP de Tailscale obtenida antes:

```ini
[Unit]
Description=MicroK8s Dashboard port-forward via Tailscale
After=network.target tailscaled.service
Wants=tailscaled.service

[Service]
Type=simple
ExecStart=/snap/bin/microk8s kubectl port-forward -n kube-system service/kubernetes-dashboard --address 100.x.x.x 10443:443
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

Guardar y salir (`Ctrl+O`, `Enter`, `Ctrl+X` en nano). Recargar systemd y habilitar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable dashboard-tunnel
sudo systemctl start dashboard-tunnel
```

Verificar que esté corriendo:

```bash
sudo systemctl status dashboard-tunnel
```

Debería mostrar `active (running)` en verde. Si dice `failed`, revisar los logs:

```bash
sudo journalctl -u dashboard-tunnel -f
```

Confirmar que el puerto esté escuchando:

```bash
sudo ss -tlnp | grep 10443
```

Debería verse el puerto `10443` en estado `LISTEN` sobre la IP de Tailscale.

Generar el token de acceso:

```bash
microk8s kubectl -n kube-system describe secret \
  $(microk8s kubectl -n kube-system get secret | grep default-token | awk '{print $1}')
```

Copiar el valor completo del campo `token:` y guardarlo en un gestor de contraseñas — no se commitea al repo, igual que el resto de los secretos de este documento.

> Si no aparece ningún `default-token`, es porque la versión de Kubernetes ya no crea uno automático — hace falta crear un `ServiceAccount` con permisos admin a mano (pedir el paso alternativo si pasa esto).

Salir de la sesión SSH — el servicio queda corriendo solo en el servidor, no hace falta mantener nada abierto:

```bash
exit
```

Acceder al Dashboard desde la PC cliente, con Tailscale conectado, abriendo en el navegador:

```
https://IP_TAILSCALE_DEL_SERVIDOR:10443
```

Va a mostrar una advertencia de certificado autofirmado (esperado, el Dashboard usa su propio certificado, no el del API server que extendimos en el paso 6) — aceptarla, elegir login con **Token**, y pegar el token generado antes.

Una vez adentro, para gestionar Secrets desde la interfaz: panel lateral izquierdo → **Secrets** → elegir namespace (o "All namespaces") → click en un Secret y el ícono de "ojo" para revelar sus valores en texto plano, o el botón **+** arriba a la derecha para crear uno nuevo por YAML.

## 8. Crear la base de datos `ticket-hub-db` en microk8s

Motor elegido: **PostgreSQL**. Corre como un Pod dentro del cluster de microk8s (no instalado directo en el sistema operativo del servidor), con sus datos en un volumen persistente y sus credenciales en un Secret de Kubernetes — el mismo tipo de recurso que ya se gestiona desde el Dashboard en el paso 7. Así, cambiar el usuario o la contraseña de la base más adelante es editar ese Secret desde la interfaz, sin tocar nada en el servidor a mano.

Todo esto se hace conectado por SSH sobre Tailscale, igual que los pasos anteriores:

```bash
ssh -i deploy_key jhon@IP_TAILSCALE
```

### 8.1. Habilitar almacenamiento persistente en microk8s

Por defecto microk8s no tiene una `StorageClass` para que los Pods pidan volúmenes persistentes. Habilitar el addon:

```bash
microk8s enable hostpath-storage
```

Esto crea la `StorageClass` `microk8s-hostpath`, que guarda los datos en disco en el propio servidor — sobreviven a que el Pod se reinicie o se recree.

### 8.2. Crear el namespace

Para no mezclar estos recursos con los del Dashboard (que vive en `kube-system`):

```bash
microk8s kubectl create namespace ticket-hub
```

### 8.3. Crear el Secret con el usuario y la contraseña

Este es el Secret que después se edita desde el Dashboard (paso 7 → Secrets → ícono de "ojo" para revelar, o el botón de editar) cada vez que haga falta rotar la credencial. Reemplazar `usuario_db` y `clave_segura` por los valores reales:

```bash
microk8s kubectl create secret generic ticket-hub-db-credentials \
  -n ticket-hub \
  --from-literal=POSTGRES_USER=usuario_db \
  --from-literal=POSTGRES_PASSWORD=clave_segura
```

> **Nota:** esta es la única vez que la credencial se escribe a mano por línea de comandos. De acá en adelante, para cambiarla, se hace desde el Dashboard — el Pod de la base la relee recién en el próximo reinicio del Pod, porque Kubernetes no reinyecta variables de entorno en un contenedor ya corriendo.

### 8.4. Definir el esquema inicial como ConfigMap

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
> **Actualización posterior:** `tickets.number` se agregó después de que esta tabla ya estaba desplegada — si estás mirando este documento para levantar la base desde cero, ya viene incluido arriba. Si en cambio ya tenés una base viva sin esa columna, no se puede recrear la tabla sin perder datos; hay que agregarla con `ALTER TABLE`, ver el paso 8.7 más abajo.

### 8.5. Crear el volumen persistente, el Deployment y el Service

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

### 8.6. Verificar

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

### 8.7. Agregar la columna `tickets.number` (migración posterior)

Esta columna se agregó al esquema después de que la base ya estaba desplegada — el `init.sql` del paso 8.4 no vuelve a correr sobre un volumen que ya tiene datos, así que hay que aplicarla a mano, una sola vez, con `ALTER TABLE`. Conectado por SSH al servidor:

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

## 9. Datos que quedan de este proceso

| Dato | Qué es | De qué paso salió | Para qué es |
|---|---|---|---|
| `SSH_USER` | El usuario del servidor, `jhon` | Paso 0 (usuario creado durante la instalación de Ubuntu Server) | Usuario con el que GitHub Actions se conecta por SSH al servidor |
| `SSH_HOST` | La IP de Tailscale del servidor (`100.x.x.x`) | Paso 2 (`tailscale status` desde la PC cliente) | Host al que se conecta el runner de CI por SSH; es la misma IP que se usa en `server:` del kubeconfig (paso 6) |
| `SSH_PRIVATE_KEY` | La clave privada `deploy_key` generada con `ssh-keygen` | Paso 3 | Autenticación SSH del runner sin contraseña |
| `pcbox-kubeconfig.yaml` | El kubeconfig de microk8s, con `server:` editado para apuntar a la IP de Tailscale en vez de a la IP local | Paso 6 (`microk8s config` + edición manual) | Credencial para administrar el cluster de forma remota — vive solo en la PC cliente, pendiente de decidir cómo se le entrega a CI cuando haga falta desplegar |
| URL del Dashboard (`https://100.x.x.x:10443`) | La IP de Tailscale del servidor + el puerto `10443` del túnel systemd | Paso 7 (`dashboard-tunnel.service`) | Acceder al Dashboard de microk8s desde el navegador, en cualquier PC conectada a la tailnet |
| Secret `ticket-hub-db-credentials` (namespace `ticket-hub`) | `POSTGRES_USER` y `POSTGRES_PASSWORD` de la base `ticket-hub-db` | Paso 8.3 (creado por `kubectl create secret`, editable después desde el Dashboard) | Credenciales de conexión a la base; cualquier rotación se hace editando este Secret desde el Dashboard, no por SSH |
| Host interno `ticket-hub-db.ticket-hub.svc.cluster.local:5432` | DNS interno del cluster que apunta al Service de la base | Paso 8.5 (`Service` `ticket-hub-db`) | Cadena de conexión que va a usar `pcbox-api` (u otro Pod del cluster) para hablarle a Postgres |