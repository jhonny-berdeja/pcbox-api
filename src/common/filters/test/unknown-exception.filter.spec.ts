import { ArgumentsHost } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { UnknownExceptionFilter } from '../unknown-exception.filter';

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

describe('UnknownExceptionFilter', () => {
  it('logs an Error instance and responds with a generic 500', () => {
    const errorSpy = jest.fn();
    const logger = { error: errorSpy } as unknown as Logger;
    const filter = new UnknownExceptionFilter(logger);

    const exception = new TypeError(
      "Cannot read properties of undefined (reading 'id')",
    );
    const status = jest.fn().mockReturnThis();
    const json = jest.fn();

    filter.catch(exception, buildHost({ status, json }));

    expect(errorSpy).toHaveBeenCalledWith({
      err: { message: exception.message, stack: exception.stack },
      errorType: 'TypeError',
      msg: 'Unhandled exception',
    });

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'An unexpected error occurred. Please try again later.',
    });
  });

  it('handles a non-Error thrown value without crashing', () => {
    const errorSpy = jest.fn();
    const logger = { error: errorSpy } as unknown as Logger;
    const filter = new UnknownExceptionFilter(logger);

    const status = jest.fn().mockReturnThis();
    const json = jest.fn();

    // JS allows `throw` on anything — a string here, not an Error.
    filter.catch('a plain string exception', buildHost({ status, json }));

    expect(errorSpy).toHaveBeenCalledWith({
      err: { message: 'a plain string exception', stack: undefined },
      errorType: 'string',
      msg: 'Unhandled exception',
    });
    expect(status).toHaveBeenCalledWith(500);
  });
});
