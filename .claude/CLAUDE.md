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
  Hoy hay tres:
  - `pcbox/` — el único módulo con controller: expone `POST /pcbox`,
    orquesta los tres gates (ver más abajo), nunca hace I/O externo por sí
    mismo — delega en los otros dos.
  - `ansible/` — todo lo relacionado con ejecutar un playbook contra el
    servidor real (`AnsibleService`, `ansible.validator.ts`).
    Sin controller: nadie le habla por HTTP directamente, solo lo consume
    `pcbox/` vía DI.
  - `ticket-hub-api/` — todo lo relacionado con hablarle a ticket-hub-api
    (`TicketHubVerificationService` + `TicketHubApiConnector`). Sin
    controller, mismo criterio. Mismo split interno que `ansible/`:
    `TicketHubApiConnector` es la mecánica HTTP cruda (URL, header del
    secreto, timeout), `TicketHubVerificationService` decide qué path
    pedir y qué significa la respuesta — ver "Handlers en el service
    general vs. service dedicado" más abajo.
  - Cada módulo con controller tiene `<funcionalidad>.module.ts`,
    `<funcionalidad>.controller.ts`, `<funcionalidad>.service.ts`; los que
    no exponen HTTP (`ansible/`, `ticket-hub-api/`) solo tienen su
    `<funcionalidad>.module.ts` + el/los service(s) que envuelven.
  - `dto/` — DTOs específicos del contrato HTTP de esa funcionalidad
    (`CreatePcboxDto`, en `pcbox/` únicamente — `ansible/`/`ticket-hub-api/`
    no tienen DTOs propios, ver su propia sección de "input shape" más
    abajo).
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
  `pcbox/` importa `ansible/` y `ticket-hub-api/` (ambos exportan su
  service); ninguno de los dos importa `pcbox/` de vuelta. Para lograrlo,
  `TicketHubVerificationService.verify()` NO toma el `CreatePcboxDto` de
  `pcbox/` — define su propio `TicketVerificationCriteria` (ver
  `ticket-hub-verification.service.ts`) con solo los campos que
  necesita, y `PcboxService` le pasa su DTO tal cual porque TypeScript lo
  acepta por tipado estructural, sin que `ticket-hub-api/` necesite
  importar nada de `pcbox/`. Si un módulo nuevo necesita algo de otro,
  aplicar el mismo criterio: nunca importar el DTO/tipo de otro módulo
  para no crear una dependencia en la dirección equivocada — definir el
  shape mínimo propio.

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

### Patrón "connector vs. service" (dentro de `ansible/` y `ticket-hub-api/`)

Ambos módulos sin controller repiten el mismo split interno: un
`<Módulo>Connector` que es pura mecánica de I/O (arma la llamada, adjunta
credenciales/timeout, no decide nada de negocio) y un `<Módulo>Service`
que es la API pública del módulo — decide *qué* pedir y *qué significa*
la respuesta, nunca hace el I/O él mismo.

- `AnsibleConnector` — arma los args de `ansible-playbook`, corre
  `execFile`, no valida nada. `AnsibleService` valida el YAML primero,
  delega en el connector, decide cómo loguear el resultado.
- `TicketHubApiConnector` — arma la URL completa, adjunta el header del
  secreto, aplica el timeout, devuelve el `Response` crudo o rechaza.
  `TicketHubVerificationService` decide qué path/query pedir para una
  verificación puntual, y qué status (o qué falla) significa "no
  matchea" — el `Response`/error crudo del connector nunca sale de este
  service.

El connector es siempre provider del módulo pero **nunca exportado** —
solo el service lo es (ver `AnsibleModule`/`TicketHubApiModule`). Nada
fuera del módulo toca el connector directo.

`PcboxService.create` es el único handler hoy, y delega en dos
colaboradores, cada uno en su propio módulo:

- `TicketHubVerificationService` (`modules/ticket-hub-api/`) — decide qué
  llamar en `GET /tickets/:number/verify` de ticket-hub-api, delegando el
  `fetch` nativo (sin agregar `axios`) en `TicketHubApiConnector`.
- `AnsibleService` (`modules/ansible/`) — escribe el YAML a un
  archivo temporal y corre `ansible-playbook` contra el servidor `pcbox`
  real.

Ambos se inyectan en `PcboxService` vía los `imports` de `PcboxModule`
(`TicketHubApiModule`, `AnsibleModule`), que solo orquesta el orden de los
tres gates (ver más abajo) — nunca arma la entidad ni la respuesta a mano,
siempre a través de `PcboxMapper`.

## Las tres validaciones de `POST /pcbox`, en orden

`PcboxService.create` corre tres gates, cada uno más caro que el
anterior, y ninguno corre si el anterior no pasó:

1. **Local, barato**: `status === 'APPROVED'` — comparación de string en
   memoria, sin I/O.
2. **Red**: `GET /tickets/:number/verify` contra ticket-hub-api — solo
   corre si el gate 1 ya pasó.
3. **CPU, sin red**: `fileContent` parsea como YAML (`js-yaml`) — solo
   corre si ticket-hub-api ya confirmó el ticket.

Recién después de los tres se persiste en `administrations` y se ejecuta el
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

## Endpoints machine-to-machine (llamadas salientes)

`TicketHubVerificationService` (`modules/ticket-hub-api/`) es la
contraparte, del lado *cliente*, del patrón que ticket-hub-api documenta
para `GET /tickets/:number/verify`
(ver su propio `.claude/CLAUDE.md`, sección "Endpoints machine-to-machine
(sin JWT de usuario)"): header `x-internal-api-key`, secreto compartido
(`TICKET_HUB_API_INTERNAL_KEY`, mismo valor que el `INTERNAL_API_KEY` de
ticket-hub-api), sin JWT de usuario en ninguno de los dos extremos. Un
`fetch` que no devuelve `200` (404, error de red, timeout) se trata
siempre igual — nunca se distingue el motivo hacia el cliente de
`pcbox-api`, mismo criterio de "revelar lo mínimo" que ticket-hub-api usa
del otro lado de esa misma llamada.
