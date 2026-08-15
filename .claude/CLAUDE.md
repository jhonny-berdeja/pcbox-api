# pcbox-api — convenciones de estructura

Estas convenciones son una réplica deliberada de las de `ticket-hub-api`
(ver su propio `.claude/CLAUDE.md` y `.claude/exception-filters-conventions.md`)
— mismo ecosistema, mismo criterio, para que no haga falta redescubrirlas
cada vez que se agrega un módulo nuevo acá. Documento más corto que el de
`ticket-hub-api` porque hoy hay pocos módulos, no porque el criterio sea
distinto.

## Organización de carpetas

- `src/common/` — infraestructura transversal, nunca específica de una
  funcionalidad:
  - `config/` — validación de variables de entorno (`env.validation.ts`)
    + el `EnvModule` global.
  - `database/<entidad>/` — una carpeta por entidad raíz, con su entity de
    TypeORM **y** su repository juntos. No separar por tipo de artefacto.
    Hoy solo `database/administration/`.
  - `dto/` — solo formas de respuesta genéricas y reutilizables
    (`ResponseBody<T>`). Los DTOs específicos de una funcionalidad van
    dentro de su propio módulo, nunca acá.
- `src/instrument/<concern>/` — infraestructura de *observability*
  (`logger/` hoy), consumida implícitamente por *toda* la app. Mismo
  criterio interno que `common/config/`: separar la construcción pura de
  opciones (`logger.config.ts`) del wiring del módulo (`logger.module.ts`).
- `src/modules/<funcionalidad>/` — una carpeta por funcionalidad/concern.
  Hoy hay dos:
  - `pcbox/` — el único módulo con controller: expone `POST /pcbox`,
    orquesta los dos gates (ver más abajo), nunca hace I/O externo por sí
    mismo — delega en `ansible/`. Ya no valida el ticket contra
    ticket-hub-api — hubo un módulo `ticket-hub-api/` para eso, se sacó
    junto con esa verificación (ver git history si hace falta).
  - `ansible/` — todo lo relacionado con ejecutar un playbook contra el
    servidor real (`AnsibleService`, `ansible.validator.ts`).
    Sin controller: nadie le habla por HTTP directamente, solo lo consume
    `pcbox/` vía DI.
  - Cada módulo con controller tiene `<funcionalidad>.module.ts`,
    `<funcionalidad>.controller.ts`, `<funcionalidad>.service.ts`; los que
    no exponen HTTP (`ansible/`) solo tienen su `<funcionalidad>.module.ts`
    + el/los service(s) que envuelven.
  - `dto/` — DTOs específicos del contrato HTTP de esa funcionalidad
    (`CreatePcboxDto`, en `pcbox/` únicamente — `ansible/` no tiene DTOs
    propios, ver su propia sección de "input shape" más abajo).
  - mappers (`<entidad>.mapper.ts`), value objects/response shapes
    (`pcbox-response.ts`) y funciones puras compartidas dentro del
    módulo (`ansible.validator.ts`) van sueltos en la raíz del
    módulo, no dentro de `dto/`.
  - `guards/` — cuando un guard es específico de esa funcionalidad (ver
    "Guards" más abajo).
- `test/` espeja a `src/`:
  - `test/common/` — infraestructura de test compartida (`InMemoryDatabaseModule`).
  - `test/modules/<funcionalidad>/` — los e2e specs de esa funcionalidad.

## Reglas de dependencia entre módulos

- `@Global()` se reserva para los módulos que toda la app necesita de forma
  implícita (`EnvModule`, `DatabaseModule`, `LoggerModule`). Siempre
  documentar, en un comentario sobre el módulo, *por qué* es global.
- Dependencia en una sola dirección, nunca circular, documentada en un
  comentario de ambos lados (mismo criterio que ticket-hub-api). Hoy:
  `pcbox/` importa `ansible/` (que exporta su service); `ansible/` no
  importa `pcbox/` de vuelta. Si un módulo nuevo necesita algo de otro,
  nunca importar el DTO/tipo de otro módulo para no crear una dependencia
  en la dirección equivocada — definir el shape mínimo propio (así se
  evitó, mientras existió, que `ansible/`/el extinto `ticket-hub-api/`
  tuvieran que importar `CreatePcboxDto`).

## Patrón builder

Toda clase con 2 o más campos obligatorios que represente un valor
construido —entities, DTOs transversales, value objects internos— lleva un
builder: un `.builder()` estático que devuelve una clase builder con campos
privados, setters fluidos `withX()`, y un `build()` que lanza `Error` si
falta algún campo obligatorio. Referencia: `AdministrationEntity`,
`ResponseBody`.

A diferencia de `TicketEntity.assignee` en ticket-hub-api (nullable, con
default `null` en el builder), **ningún** campo de `AdministrationEntity`
es opcional — la tabla `administrations` no tiene columnas `nullable`, así
que su builder no tiene defaults: todos los `withX()` son obligatorios o
`build()` lanza.

## Patrón de mappers

Cada entidad/valor construido tiene un mapper dedicado (`<Nombre>Mapper`),
en la raíz del módulo al que pertenece, con métodos **únicamente
`static`** — funciones puras, sin I/O ni estado. Un método por dirección
de transformación (`toEntity`, `toResponse`, ...), cada operación de
escritura con su propio método de mapeo. No tiene por qué ser una entidad
expuesta por HTTP directamente: `AnsibleMapper` (`modules/ansible/`) mapea
un resultado crudo de `execFile` a `AnsibleExecutionResult`, algo que
`AnsibleConnector` nunca ve fuera de este módulo. Referencias:
`PcboxMapper`, `AnsibleMapper`.

## Handlers en el service general vs. service dedicado

El service general de un módulo (`<Módulo>Service`) reúne los métodos
handler de sus casos de uso (uno por endpoint). Un handler que depende de
un colaborador con una responsabilidad propia y sustancial (una llamada de
red externa, un proceso hijo) extrae ese colaborador a su propio service
inyectable — igual que ticket-hub-api extrae `VerifyTicketService`/
`ApproveTicketService` fuera de `TicketsService`. Acá se fue un paso más
allá: como cada colaborador es además un *concern* completo con varios
archivos propios (service + connector + lo que haga falta — ver el
patrón "connector vs. service" más abajo), cada uno se promovió a su
propio módulo en vez de quedar como un provider más dentro de `pcbox/` —
ver "Reglas de dependencia entre módulos" más arriba.

### Patrón "connector vs. service" (dentro de `ansible/`)

`ansible/`, el único módulo sin controller hoy, sigue este split interno:
un `<Módulo>Connector` que es pura mecánica de I/O (arma la llamada,
adjunta credenciales/timeout, no decide nada de negocio) y un
`<Módulo>Service` que es la API pública del módulo — decide *qué* pedir y
*qué significa* la respuesta, nunca hace el I/O él mismo.

- `AnsibleConnector` — arma los args de `ansible-playbook`, corre
  `execFile`, no valida nada. `AnsibleService` valida el YAML primero,
  delega en el connector, decide cómo loguear el resultado.

El connector es siempre provider del módulo pero **nunca exportado** —
solo el service lo es (ver `AnsibleModule`). Nada fuera del módulo toca el
connector directo.

`PcboxService.create` es el único handler hoy, y delega en un solo
colaborador:

- `AnsibleService` (`modules/ansible/`) — escribe el YAML a un
  archivo temporal y corre `ansible-playbook` contra el servidor `pcbox`
  real.

Se inyecta en `PcboxService` vía los `imports` de `PcboxModule`
(`AnsibleModule`), que solo orquesta el orden de los dos gates (ver más
abajo) — nunca arma la entidad ni la respuesta a mano, siempre a través de
`PcboxMapper`.

## Las dos validaciones de `POST /pcbox`, en orden

`PcboxService.create` corre dos gates, cada uno más caro que el
anterior, y ninguno corre si el anterior no pasó:

1. **Local, barato**: `status === 'APPROVED'` — comparación de string en
   memoria, sin I/O.
2. **CPU, sin red**: `fileContent` parsea como YAML (`js-yaml`) — solo
   corre si el gate 1 ya pasó.

Ya no hay un gate de red: hasta hace poco había un tercero (`GET
/tickets/:number/verify` contra ticket-hub-api), se sacó junto con el
módulo `ticket-hub-api/` — ya no se valida el ticket contra ticket-hub-api.

Recién después de los dos se persiste en `administrations` y se ejecuta el
playbook. Cualquier gate nuevo que se agregue a este flujo debe respetar el
mismo criterio: lo más barato primero, y un test que confirme que el gate
siguiente nunca corre si el anterior rechazó (ver
`pcbox.service.spec.ts`).

## Guards

Este repo **no tiene** un guard global (no hay JWT de usuario, nunca lo
hubo) — a diferencia de ticket-hub-api, ningún endpoint necesita
`@Public()` para saltear nada. `AdminApiKeyGuard`
(`modules/pcbox/guards/admin-api-key.guard.ts`) se aplica
directo con `@UseGuards(AdminApiKeyGuard)` a nivel de controller (no
route-level: hoy todas las rutas de `PcboxController` lo
necesitan).

Vive dentro de `modules/pcbox/guards/` y no en
`common/guards/` porque hoy es específico de esa única funcionalidad — si
un segundo módulo llegara a necesitar el mismo guard, ese es el momento de
subirlo a `common/guards/` (mismo criterio de "no hay abstracción todavía
porque no hay un segundo caso" que rige el resto de este documento).

Mismo patrón exacto que `InternalApiKeyGuard` de ticket-hub-api: header
fijo (`x-admin-api-key`), secreto compartido por env var (`ADMIN_API_KEY`),
`UnauthorizedException` genérica en cualquier mismatch.

Este endpoint hoy tiene dos callers distintos, ambos autenticados igual
(el guard no distingue quién llama): un admin humano a mano, y
`ticket-hub-api`'s `ApproveTicketService` automáticamente después de
aprobar un ticket (ver ese repo, módulo `pcbox-api/` — mismo nombre que
este repo, cosas distintas). `ticket-hub-api` usa un secreto propio
(`PCBOX_API_ADMIN_KEY` de su lado) que debe coincidir con el
`ADMIN_API_KEY` de acá — dos env vars con nombre distinto, mismo valor.

## Variables de entorno

`src/common/config/env.validation.ts` es la única fuente de verdad para las
variables de entorno requeridas (todas obligatorias, validadas con
`class-validator`). Cualquier variable que se agregue, quite o renombre ahí
debe reflejarse tanto en `.env.example` como en la tabla del `README.md`
— las tres nunca deben desincronizarse.

La clave privada SSH (`/etc/ssh-keys/pcbox_deploy_key`) **no** es una
variable de entorno — es un archivo montado desde un Secret de Kubernetes
(ver `documentation/pcbox.administrations-deploy.md`). Nunca agregarla a
`env.validation.ts` ni a ningún log: le da a esta app acceso administrativo
real al servidor `pcbox`.

`pcbox-api` no habla con ticket-hub-api: hubo una llamada saliente (login +
`GET /tickets/by-number/:number` + `GET /users`, para verificar el ticket
antes de ejecutar el playbook) implementada en un módulo `ticket-hub-api/`
propio, con su cuenta de servicio y credenciales dedicadas — se sacó por
completo, `department`/`approver`/`informer`/`ticketNumber` ahora solo se
guardan como metadata del registro, sin validarse contra nada externo.
