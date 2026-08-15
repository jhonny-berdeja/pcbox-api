import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { buildLoggerOptions } from './logger.config';

/**
 * `@Global()` for the same reason as `EnvModule`/`DatabaseModule`
 * (`src/common/`): every part of the app needs to log, implicitly, so
 * `nestjs-pino`'s `Logger`/`PinoLogger` must be injectable everywhere
 * without every feature module importing this one explicitly.
 *
 * Library choice: `nestjs-pino` over Nest's built-in logger because it (1)
 * emits structured JSON by default — required for Loki/Promtail to index
 * fields like `level`/`req.id` instead of grepping plain text (see
 * `documentation/pcbox.loki-deploy.md`); (2) replaces Nest's internal
 * logger via `app.useLogger()`, so framework messages (bootstrap, route
 * mapping) are JSON too, not just app-level logs; and (3) auto-instruments
 * every HTTP request/response with a correlation `req.id` via `pino-http`,
 * with no extra interceptor code.
 *
 * Especially important here: `AnsibleService` logs the full
 * result (stdout/stderr/exit code) of every real playbook run against
 * `pcbox` — that's the audit trail for a genuinely administrative action,
 * and it has to reach Loki as structured, queryable JSON, not plain text.
 *
 * No conditional "pretty" transport for local dev: this app runs only as a
 * Pod in the microk8s `pcbox-api` namespace, so stdout always goes to Loki
 * and JSON is always the right format.
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildLoggerOptions(configService.get<string>('LOG_LEVEL')!),
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
