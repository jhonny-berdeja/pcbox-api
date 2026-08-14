# Instalación de microk8s y su Dashboard (servidor pcbox)

Instalación de microk8s en el servidor `pcbox`, extensión del certificado del API server para que sea alcanzable por Tailscale, generación del kubeconfig para administrarlo de forma remota, y habilitación del Dashboard web. Continúa desde `pcbox.bootstrap.md` (pasos 0 a 4: instalación de Ubuntu Server, OpenSSH, Tailscale, clave SSH sin contraseña, y sudo sin contraseña).

## 0. Punto de partida

Conectarse al servidor por SSH sobre la IP de Tailscale (secret `SSH_HOST`, obtenida en `pcbox.bootstrap.md`, paso 2):

```bash
ssh -i deploy_key jhon@IP_TAILSCALE
```

Todos los comandos de este documento se corren desde esa sesión.

## 1. Instalar microk8s

A diferencia de los pasos anteriores, esto se instala a mano y se mantiene fuera de Ansible/CI a propósito (no hay ningún playbook que lo instale ni lo gestione).

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

## 2. Extender el certificado del API server para Tailscale y preparar el kubeconfig para CI

Por defecto, el certificado que el API server de microk8s le muestra a quien se conecta solo es válido para la IP local del servidor — no para la IP de Tailscale (`100.x.x.x`, la misma ya guardada como secret `SSH_HOST` en `pcbox.bootstrap.md`, paso 2). Como el runner de GitHub Actions se conecta por Tailscale, hay que extender ese certificado para que también sea válido desde esa IP.

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

## 3. Habilitar y acceder al Dashboard de microk8s

Conectarse al servidor y verificar que microk8s esté corriendo:

```bash
ssh -i deploy_key jhon@IP_TAILSCALE
microk8s status --wait-ready
```

Debería devolver `microk8s is running`.

Obtener la IP de Tailscale del servidor — es la misma que ya está guardada como secret `SSH_HOST` (`pcbox.bootstrap.md`, paso 2), pero por si hace falta volver a consultarla desde la sesión SSH:

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

Va a mostrar una advertencia de certificado autofirmado (esperado, el Dashboard usa su propio certificado, no el del API server que extendimos en el paso 2) — aceptarla, elegir login con **Token**, y pegar el token generado antes.

Una vez adentro, para gestionar Secrets desde la interfaz: panel lateral izquierdo → **Secrets** → elegir namespace (o "All namespaces") → click en un Secret y el ícono de "ojo" para revelar sus valores en texto plano, o el botón **+** arriba a la derecha para crear uno nuevo por YAML.

## 4. Datos que quedan de este proceso

| Dato | Qué es | De qué paso salió | Para qué es |
|---|---|---|---|
| `pcbox-kubeconfig.yaml` | El kubeconfig de microk8s, con `server:` editado para apuntar a la IP de Tailscale en vez de a la IP local | Paso 2 (`microk8s config` + edición manual) | Credencial para administrar el cluster de forma remota — vive solo en la PC cliente, pendiente de decidir cómo se le entrega a CI cuando haga falta desplegar |
| URL del Dashboard (`https://100.x.x.x:10443`) | La IP de Tailscale del servidor + el puerto `10443` del túnel systemd | Paso 3 (`dashboard-tunnel.service`) | Acceder al Dashboard de microk8s desde el navegador, en cualquier PC conectada a la tailnet |
