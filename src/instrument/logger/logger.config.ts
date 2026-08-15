import { randomUUID } from 'node:crypto';
import { Options } from 'pino-http';

/**
 * No `req.headers.x-admin-api-key` / `req.headers.x-internal-api-key-`style
 * entries here on purpose, mirroring ticket-hub-api's own redact list — the
 * bigger secret this app holds, the SSH private key mounted at
 * `/etc/ssh-keys/pcbox_deploy_key`, never enters this path at all: it's
 * only ever passed to `execFile('ansible-playbook', ...)` as a file path
 * argument (see AnsibleService), and its *contents* are never
 * read into app memory or into any logged object, so no redact rule is
 * needed to keep it out of Loki — the leak is structurally impossible
 * instead of merely redacted.
 */
export function buildLoggerOptions(level: string): { pinoHttp: Options } {
  return {
    pinoHttp: {
      level,
      genReqId: () => randomUUID(),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'req.body.password',
          'req.body.access_token',
          'err.parameters',
        ],
        censor: '[REDACTED]',
      },
    },
  };
}
