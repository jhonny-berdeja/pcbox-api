# pcbox-api

Este proyecto es para todo lo que tiene que ver con la gestión del servidor `pcbox` — el servidor que usa todo el ecosistema `jtagram`.

## Cómo montar el ecosistema

Para dejar el servidor listo, seguir los documentos de `documentation/` **en este orden**:

1. [`documentation/pcbox.bootstrap.md`](./documentation/pcbox.bootstrap.md) — configuración inicial del servidor (Ubuntu Server, SSH, Tailscale, sudo sin contraseña).
2. [`documentation/pcbox.microk8s-setup.md`](./documentation/pcbox.microk8s-setup.md) — instalación de microk8s, certificado del API server para Tailscale, kubeconfig, y el Dashboard.
3. [`documentation/pcbox.ticket-hub-db-deploy.md`](./documentation/pcbox.ticket-hub-db-deploy.md) — deploy de la base de datos `ticket-hub-db` en microk8s.
4. [`documentation/pcbox.grafana-deploy.md`](./documentation/pcbox.grafana-deploy.md) — deploy de Grafana en microk8s.

Después de eso, hay que clonar y deployar `ticket-hub` y `ticket-hub-api` — cada uno tiene su propia documentación, dentro de su propio repo, para hacerlo.

Con eso, el ecosistema ya queda montado. Lo único que va quedando pendiente de ahí en adelante es clonar y deployar los distintos proyectos de `jtagram` a medida que se necesiten.
