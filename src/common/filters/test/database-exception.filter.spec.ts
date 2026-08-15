import { ArgumentsHost } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { QueryFailedError } from 'typeorm';
import { DatabaseExceptionFilter } from '../database-exception.filter';

function buildHost(response: {
  status: jest.Mock;
  json: jest.Mock;
}): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

describe('DatabaseExceptionFilter', () => {
  it('logs a safe, hand-built err object plus the query — never the raw exception', () => {
    const errorSpy = jest.fn();
    const logger = { error: errorSpy } as unknown as Logger;
    const filter = new DatabaseExceptionFilter(logger);

    const exception = new QueryFailedError(
      'INSERT INTO administrations (department) VALUES ($1)',
      ['Datacenter'],
      new Error('connection terminated unexpectedly'),
    );
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();
    const response = { status, json };

    filter.catch(exception, buildHost(response));

    // Called with a single object — no second string argument. nestjs-pino's
    // Logger treats a trailing string as `context`, not `msg` (Nest's
    // LoggerService convention, not pino's native (obj, msg)); `msg` has to
    // be a key inside the object instead, see the filter's own comment.
    expect(errorSpy).toHaveBeenCalledWith({
      err: { message: exception.message, stack: exception.stack },
      errorType: 'QueryFailedError',
      query: exception.query,
      msg: 'Database error',
    });

    // The whole point: `err` must NOT be the raw exception instance — pino's
    // default error serializer walks every enumerable property of whatever
    // it's given, so passing the real QueryFailedError would leak
    // `.parameters` and `.driverError` regardless of any `redact` rule.
    const [loggedObject] = errorSpy.mock.calls[0] as [Record<string, unknown>];
    expect(loggedObject.err).not.toBe(exception);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'An unexpected error occurred. Please try again later.',
    });
    // The client response must never contain the query or its bound values.
    const [responseBody] = json.mock.calls[0] as [Record<string, unknown>];
    expect(JSON.stringify(responseBody)).not.toContain('INSERT');
  });
});
