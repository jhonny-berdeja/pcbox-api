import { buildLoggerOptions } from './logger.config';

describe('buildLoggerOptions', () => {
  it('sets the pino level from the given value', () => {
    const options = buildLoggerOptions('debug');

    expect(options.pinoHttp.level).toBe('debug');
  });

  it('redacts headers/body fields that can carry credentials', () => {
    const options = buildLoggerOptions('info');
    const redact = options.pinoHttp.redact;

    if (Array.isArray(redact) || !redact) {
      throw new Error('expected redact to be a redactOptions object');
    }

    expect(redact.paths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'req.body.password',
        'req.body.access_token',
        'err.parameters',
      ]),
    );
  });

  it("generates a unique UUID per request instead of pino-http's default sequential counter", () => {
    const options = buildLoggerOptions('info');
    const genReqId = options.pinoHttp.genReqId;

    if (!genReqId) {
      throw new Error('expected genReqId to be set');
    }

    const uuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const first = genReqId(undefined as never, undefined as never);
    const second = genReqId(undefined as never, undefined as never);

    expect(first).toMatch(uuidV4);
    expect(second).toMatch(uuidV4);
    expect(first).not.toBe(second);
  });
});
